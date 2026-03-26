import { Config } from '@remotion/cli/config';

// Faster renders — jpeg has minimal quality loss for social video
Config.setVideoImageFormat('jpeg');

// Always overwrite output files (safe for scripted pipelines)
Config.setOverwriteOutput(true);

// Parallel rendering threads — tune to your machine
Config.setConcurrency(4);
