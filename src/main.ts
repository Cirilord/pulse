#!/usr/bin/env node

import { cac } from 'cac';

const cli = cac('pulse');

cli.command('compile <input>', 'Compile a Pulse source file').action(function compileCommand(): void {});

cli.help();
cli.parse();
