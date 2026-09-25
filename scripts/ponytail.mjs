#!/usr/bin/env node
/**
 * Ponytail CLI Helper for DripLnk
 * Provides CLI access to Ponytail's lazy senior dev audit, debt tracking, and scoreboard.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const command = process.argv[2] || 'help';

switch (command) {
  case 'audit': {
    console.log('=== PONYTAIL WHOLE-REPO AUDIT ===');
    console.log('Scanning tree for over-engineering, dead code, and bloat...\n');

    // Run quick checks
    const findings = [];

    // 1. Check for unreferenced files in lib/
    if (fs.existsSync('lib')) {
      const libFiles = fs.readdirSync('lib').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      for (const f of libFiles) {
        const base = f.replace(/\.(ts|tsx)$/, '');
        try {
          const callers = execSync(`grep -rFl "@/lib/${base}" app components driplnk-web-backend lib || true`, { encoding: 'utf8' }).trim();
          const count = callers ? callers.split('\n').filter(x => !x.endsWith(f)).length : 0;
          if (count === 0) {
            findings.push(`delete: uncalled file lib/${f}. Replacement: none.`);
          }
        } catch (_) {}
      }
    }

    // 2. Check for unused components
    if (fs.existsSync('components')) {
      const walk = (d, list = []) => {
        for (const f of fs.readdirSync(d)) {
          const p = path.join(d, f);
          if (fs.statSync(p).isDirectory()) walk(p, list);
          else if (/\.(tsx|ts)$/.test(f)) list.push(p);
        }
        return list;
      };
      const comps = walk('components');
      for (const c of comps) {
        const base = path.basename(c, path.extname(c));
        const pattern = '@/components/' + c.replace(/^components\//, '').replace(/\.(tsx|ts)$/, '');
        try {
          const out = execSync(`grep -rFl "${pattern}" app components || true`, { encoding: 'utf8' }).trim();
          const callers = out ? out.split('\n').filter(x => x !== c) : [];
          if (callers.length === 0) {
            const out2 = execSync(`grep -rEl "from ['\"].*${base}['\"]" app components || true`, { encoding: 'utf8' }).trim();
            const callers2 = out2 ? out2.split('\n').filter(x => x !== c) : [];
            if (callers2.length === 0) {
              findings.push(`delete: unused component ${c}. Replacement: none.`);
            }
          }
        } catch (_) {}
      }
    }

    if (findings.length === 0) {
      console.log('Lean already. Ship.');
    } else {
      findings.forEach(f => console.log(`- ${f}`));
      console.log(`\nFound ${findings.length} candidates for simplification.`);
    }
    break;
  }

  case 'debt': {
    console.log('=== PONYTAIL DEBT LEDGER ===');
    console.log('Scanning codebase for deliberate `ponytail:` comments...\n');
    try {
      const out = execSync("grep -rnE '(//|#|/\\*) ?ponytail:' app components driplnk-web-backend lib supabase || true", { encoding: 'utf8' }).trim();
      if (!out) {
        console.log('No deferred ponytail debt comments found. Clean ledger.');
      } else {
        console.log(out);
      }
    } catch (e) {
      console.error(e);
    }
    break;
  }

  case 'gain': {
    console.log('=== PONYTAIL BENCHMARK SCOREBOARD ===');
    console.log('Published benchmark medians across real agentic tasks:\n');
    console.log('  Code written:  ~54% less code (up to 94% on over-build traps)');
    console.log('  Token cost:    ~20% cheaper');
    console.log('  Speed:         ~27% faster');
    console.log('  Safety:        100% safe (all validation, RLS, & auth preserved)');
    console.log('\n"The best code is the code you never wrote."');
    break;
  }

  case 'help':
  default: {
    console.log('Ponytail CLI Commands:');
    console.log('  node scripts/ponytail.mjs audit    Scan repo for dead code & over-engineering');
    console.log('  node scripts/ponytail.mjs debt     Harvest all `ponytail:` comment markers');
    console.log('  node scripts/ponytail.mjs gain     Display benchmark scoreboard');
    console.log('  node scripts/ponytail.mjs help     Show this help message');
    break;
  }
}
