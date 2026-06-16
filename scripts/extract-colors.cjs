#!/usr/bin/env node
/**
 * extract-colors.cjs — Generic UI color extractor template
 *
 * Usage:
 *   node extract-colors.cjs --url http://localhost:5173 --scheme dark
 *
 * Copy this file to your project's scripts/ directory and:
 * 1. Add project-specific setup in setupApp()
 * 2. Add project token definitions to TOKENS
 * 3. Adjust element selectors/heuristics if needed
 *
 * Output: screenshots/audit-<scheme>-report.json + screenshots/audit-<scheme>.png
 */

'use strict';

const path = require('path');
const fs = require('fs');
const puppeteer = require('C:/@projects/eruto-skills/research-note/node_modules/puppeteer-core');

// ─── Chrome detection ───
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const c of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ]) { if (fs.existsSync(c)) return c; }
  return null;
}

// ─── Args ───
function parseArgs(argv) {
  const args = argv.slice(2), opts = { url: 'http://localhost:5173', scheme: 'dark' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i+1]) opts.url = args[++i];
    if (args[i] === '--scheme' && args[i+1]) opts.scheme = args[++i];
  }
  return opts;
}

// ─── CUSTOMIZE: Token definitions (from your project's colors.*.ts) ───
// Extract from light-dark(<light>, <dark>) — use lowercase hex
const TOKENS = {
  dark: {
    // Example: '#262830': 'surfaceHigh',
    //          '#e3e2e6': 'textPrimary',
  },
  light: {
    // Example: '#eae7f0': 'surfaceHigh',
    //          '#1b1b1f': 'textPrimary',
  },
};

// ─── Color math ───
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgbToHex(r, g, b) { return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''); }
function sRGBToLinear(c) { const s=c/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); }
function relativeLuminance({r,g,b}) { return 0.2126*sRGBToLinear(r)+0.7152*sRGBToLinear(g)+0.0722*sRGBToLinear(b); }
function contrastRatio(c1,c2) {
  const l1=Math.max(relativeLuminance(c1),relativeLuminance(c2));
  const l2=Math.min(relativeLuminance(c1),relativeLuminance(c2));
  return (l1+0.05)/(l2+0.05);
}
function matchToken(rgb, scheme) {
  if (!rgb) return null;
  const hex = rgbToHex(rgb.r,rgb.g,rgb.b);
  const map = TOKENS[scheme]||{};
  if (map[hex]) return { hex, token: map[hex], distance: 0 };
  let best=null, bestDist=Infinity;
  for (const [th,tn] of Object.entries(map)) {
    const t=hexToRgb(th), d=(rgb.r-t.r)**2+(rgb.g-t.g)**2+(rgb.b-t.b)**2;
    if (d<bestDist) { bestDist=d; best={hex:th,token:tn,distance:d}; }
  }
  return best?.distance<400?best:{hex,token:null,distance:bestDist};
}

// ─── Browser-side extraction (self-contained IIFE string) ───
const BROWSER_AUDIT_FN = `
(function auditPage() {
  function parseRgba(s) {
    const m = s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    return m ? { r:+m[1], g:+m[2], b:+m[3], a: m[4]!==undefined?+m[4]:1 } : null;
  }
  function blend(src,dst) {
    const a=src.a;
    return {r:Math.round(src.r*a+dst.r*(1-a)),g:Math.round(src.g*a+dst.g*(1-a)),b:Math.round(src.b*a+dst.b*(1-a)),a:1};
  }
  function resolveBackground(el) {
    let opacityStack=1, bgStack=null, cur=el;
    while(cur && cur!==document.documentElement) {
      const style=window.getComputedStyle(cur);
      const op=parseFloat(style.opacity);
      if(!isNaN(op) && op<1) opacityStack*=op;
      const bg=parseRgba(style.backgroundColor);
      if(bg && bg.a>0) { bgStack=bgStack?blend(bg,bgStack):bg; if(bg.a>=1)break; }
      cur=cur.parentElement;
    }
    if(!bgStack) {
      const scheme=document.documentElement.style.colorScheme||'';
      bgStack=scheme.includes('light')?{r:255,g:255,b:255,a:1}:{r:17,g:19,b:24,a:1};
    }
    return { effectiveBg:bgStack, opacityStack };
  }
  function isCounterValue(el,style) {
    const fv=style.fontVariant||style.fontVariantNumeric||style.getPropertyValue('font-variant-numeric')||'';
    return /^-?\\d+$/.test(el.textContent.trim()) && parseFloat(style.fontSize)>=12 && fv.includes('tabular-nums');
  }
  const results=[], seen=new Set();
  for(const el of document.querySelectorAll('*')) {
    if(!el.textContent?.trim()) continue;
    const rect=el.getBoundingClientRect();
    if(rect.width<2||rect.height<2) continue;
    const style=window.getComputedStyle(el);
    if(style.display==='none'||style.visibility==='hidden') continue;
    if(el.querySelectorAll('*').length>8) continue;
    const key=el.tagName+'|'+Math.round(rect.x)+'|'+Math.round(rect.y);
    if(seen.has(key)) continue; seen.add(key);
    const fgColor=parseRgba(style.color); if(!fgColor) continue;
    const {effectiveBg,opacityStack}=resolveBackground(el);
    const eFg=opacityStack>=1?fgColor:blend({...fgColor,a:opacityStack},effectiveBg);
    const fontSize=parseFloat(style.fontSize);
    results.push({
      tag:el.tagName.toLowerCase(),text:el.textContent.trim().slice(0,40),
      rect:{x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)},
      fg:fgColor,effectiveFg:eFg,bg:effectiveBg,
      opacityStack:Math.round(opacityStack*100)/100,
      fontSize:Math.round(fontSize),fontWeight:parseFloat(style.fontWeight)||400,
      isLargeText:fontSize>=24||(fontSize>=18.67&&(parseFloat(style.fontWeight)||400)>=700),
      isCounterValue:isCounterValue(el,style),
    });
  }
  return results;
})()
`;

// ─── CUSTOMIZE: App-specific setup ───
async function setupApp(page, url, scheme) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((s) => { document.documentElement.style.colorScheme = s; }, scheme);
  // Add project-specific steps here:
  // - IndexedDB seeding
  // - Login / profile creation
  // - Navigation to the target screen
  await new Promise(r => setTimeout(r, 1000));
}

// ─── Report ───
function buildReport(rawEls, scheme) {
  return rawEls.map(el => {
    const cr = contrastRatio(el.effectiveFg, el.bg);
    const isLarge = el.isLargeText;
    const wcagAA = isLarge ? cr >= 3 : cr >= 4.5;
    return {
      label: el.isCounterValue ? `[COUNTER] "${el.text}"` : `"${el.text}"`,
      text: el.text, rect: el.rect, isCounterValue: el.isCounterValue, isLargeText: isLarge,
      opacityStack: el.opacityStack,
      fg: { hex: rgbToHex(el.effectiveFg.r,el.effectiveFg.g,el.effectiveFg.b), ...el.effectiveFg },
      bg: { hex: rgbToHex(el.bg.r,el.bg.g,el.bg.b), ...el.bg },
      fgToken: matchToken(el.effectiveFg, scheme),
      bgToken: matchToken(el.bg, scheme),
      contrastRatio: Math.round(cr*100)/100,
      wcagAA,
      issue: !wcagAA ? `CONTRAST FAIL: ${cr.toFixed(2)}:1` :
             el.opacityStack<0.9 ? `opacity stacking ×${el.opacityStack}` : null,
    };
  }).sort((a,b) => (a.issue&&!b.issue?-1:!a.issue&&b.issue?1:0)||(a.rect.y-b.rect.y));
}

// ─── Main ───
async function main() {
  const opts = parseArgs(process.argv);
  const chromePath = findChrome();
  if (!chromePath) { console.error('Chrome not found'); process.exit(1); }

  const outDir = path.join(__dirname, '..', '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await setupApp(page, opts.url, opts.scheme);

    const rawEls = await page.evaluate(BROWSER_AUDIT_FN.trim());
    const report = buildReport(rawEls, opts.scheme);

    const issues = report.filter(e => e.issue);
    console.log(`\nAudit — ${opts.scheme} mode: ${report.length} elements, ${issues.length} issues`);
    for (const e of issues) {
      console.log(`  ⚠ ${e.label} — ${e.issue}`);
      console.log(`    fg: ${e.fg.hex} (${e.fgToken?.token??'?'})  bg: ${e.bg.hex} (${e.bgToken?.token??'?'})`);
    }
    for (const e of report.filter(e => e.isCounterValue)) {
      const ok = e.wcagAA ? '✓' : '✗';
      console.log(`  ${ok} ${e.label} — ${e.contrastRatio}:1${e.opacityStack<1?' [opacity×'+e.opacityStack+']':''}`);
    }

    const screenshotPath = path.join(outDir, `audit-${opts.scheme}.png`);
    const reportPath = path.join(outDir, `audit-${opts.scheme}-report.json`);
    await page.screenshot({ path: screenshotPath });
    fs.writeFileSync(reportPath, JSON.stringify({ scheme: opts.scheme, elements: report }, null, 2));
    console.log(`\nSaved: ${screenshotPath}\nReport: ${reportPath}`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
