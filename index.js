const puppeteer = require('puppeteer-core');
const chrome = require("chrome-aws-lambda");
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const express = require('express');
const sha256 = require('js-sha256');

const NodeCache = require('node-cache');

require('dotenv').config();

const gamedayCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
});

const exePath =
  process.platform === "win32"
    ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "linux"
    ? "/usr/bin/google-chrome"
    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

getOptions = async (isDev) => {
  let options;
  if (isDev) {
    options = {
      args: [],
      executablePath: exePath,
      headless: true,
    };
  } else {
    options = {
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
    };
  }
  return options;
}

const app = express();
const port = 8080;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('welcome');
});

app.get('/get-bundesliga-picks', (req, res) => {
  const today = new Date();
  const date = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const data = gamedayCache.get(date);
  const { currentGameday } = data;

  currentGameday.forEach((match) => {
    const getPick = () => {
      if (match.drawQuote <= 2.0) return '1:1';
      if (match.homeTeamQuote < match.awayTeamQuote) return '2:1';
      return '1:2'
    };
    console.log('Match:', `${match.homeTeamName} (${match.homeTeamQuote}) - ${match.awayTeamName} (${match.awayTeamQuote})`);
    console.log(getPick());
    console.log('###################################');
    console.log('###################################');
  });

  res.send(currentGameday)
});

app.get('/get-bundesliga-odds', async (req, res) => {
  const today = new Date();
  const date = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const isDev = process.env.NODE_ENV === 'development';
  if (gamedayCache.get(date)) {
    res.send(gamedayCache.get(date));
  } else {
    const options = await getOptions(isDev);
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    await page.goto('https://sports.tipico.de/de/alle/fussball/deutschland/bundesliga');
    await page.waitForSelector('#_evidon-accept-button');
    await page.click('#_evidon-accept-button');

    const content = await page.content();
    const $ = cheerio.load(content);

    const allMatches = $('.EventRow-styles-event-row').get().map((match) => {
      const homeTeamName = $(match).find('.EventTeams-styles-event-teams.EventTeams-styles-additional-margin > div > div:nth-child(1) > span').text();
      const awayTeamName = $(match).find('.EventTeams-styles-event-teams.EventTeams-styles-additional-margin > div > div:nth-child(2) > span').text();
      const homeTeamQuote = parseFloat($(match).find('.EventOddGroup-styles-odd-groups button:nth-child(1)').text().replace(',', '.'));
      const drawQuote = parseFloat($(match).find('.EventOddGroup-styles-odd-groups button:nth-child(2)').text().replace(',', '.'));
      const awayTeamQuote = parseFloat($(match).find('.EventOddGroup-styles-odd-groups button:nth-child(3)').last().text().replace(',', '.'));

      return {
        homeTeamName,
        homeTeamQuote,
        drawQuote,
        awayTeamName,
        awayTeamQuote,
      };
    });

    await page.close();
    await browser.close();

    const currentGameday = allMatches.slice(0, 9);
    const futureGameday = allMatches.slice(9, 18);

    gamedayCache.set(date, {
      currentGameday,
      futureGameday,
    });

    res.send({
      currentGameday,
      futureGameday,
    });
  }
});

app.listen(port, async () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
