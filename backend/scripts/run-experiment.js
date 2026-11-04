'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Resvg } = require('@resvg/resvg-js');

const { buildScenario } = require('../src/experiment/scenario');
const { runExperiment } = require('../src/experiment/experiment');
const { runsCsv, summaryCsv, tablesMd } = require('../src/experiment/report');
const { meanChart, convergenceChart } = require('../src/experiment/charts');
const { Z_OF_CONFIDENCE } = require('../src/experiment/statistics');

function readConfig(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  if (!args['--config']) throw new Error('--config is required, e.g. --config experiments/thesis.json');

  const file = path.resolve(args['--config']);
  const config = { epsilonPercent: 5, confidence: 0.95, ...JSON.parse(fs.readFileSync(file, 'utf8')) };

  if (args['--epsilon']) config.epsilonPercent = Number(args['--epsilon']);
  if (args['--confidence']) config.confidence = Number(args['--confidence']);
  if (args['--levels']) config.levels = args['--levels'].split(',').map(Number);

  config.z = Z_OF_CONFIDENCE[config.confidence];
  if (!config.z) throw new Error('--confidence must be 0.95 or 0.997');

  return { config, file, name: path.basename(file, '.json') };
}

const FIGURE_DPI = 300;
const FIGURE_WIDTH_CM = 16;

//ширина рисунка у Word — 16 см
function withDpi(png, dpi) {
  const perMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(13);
  data.write('pHYs', 0, 'ascii');
  data.writeUInt32BE(perMetre, 4);
  data.writeUInt32BE(perMetre, 8);
  data[12] = 1;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(9);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(data));
  return Buffer.concat([png.subarray(0, 33), length, data, crc, png.subarray(33)]);
}

function writeFigure(folder, name, svg) {
  fs.writeFileSync(path.join(folder, `${name}.svg`), svg);
  const width = Math.round((FIGURE_WIDTH_CM / 2.54) * FIGURE_DPI);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render();
  fs.writeFileSync(path.join(folder, `${name}.png`), withDpi(png.asPng(), FIGURE_DPI));
}

function main() {
  const { config, file, name } = readConfig(process.argv.slice(2));
  const catalog = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), config.catalog), 'utf8'));
  const scenario = buildScenario(catalog, config);
  const started = Date.now();

  console.log(`[experiment] ${scenario.planned.length} planned tasks, T = ${scenario.capacityMinutes} working minutes`);

  const result = runExperiment(scenario, config, (message) => console.log(`[experiment] ${message}`));

  const folder = path.resolve('results', name);
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  fs.writeFileSync(path.join(folder, 'runs.csv'), runsCsv(result.records));
  fs.writeFileSync(path.join(folder, 'summary.csv'), summaryCsv(result.summary));
  fs.writeFileSync(path.join(folder, 'tables.md'), tablesMd(result.summary, config, scenario));
  writeFigure(folder, 'z-mean', meanChart(result.summary, config));
  writeFigure(folder, 'convergence', convergenceChart(result.records, result.summary, config, result.convergenceN));

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`[experiment] ${result.records.length} runs in ${seconds} s, results: ${folder}`);
}

main();
