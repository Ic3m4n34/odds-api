const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const express = require('express');
const sha256 = require('js-sha256');

const NodeCache = require('node-cache');

const gamedayCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
});

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.get('/get-bundesliga-odds', async (req, res) => {
  /* if (gamedayCache.get(collectionName)) {
    res.send(gamedayCache.get(collectionName));
  } else {
  } */
  const browser = await puppeteer.launch({
      headless: true,
    });
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

    // const hash = sha256(JSON.stringify({currentGameday, futureGameday}));

    // gamedayCache.set(collectionName, returnValues);

    res.send({
      currentGameday,
      futureGameday,
    });
});

app.listen(port, async () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
