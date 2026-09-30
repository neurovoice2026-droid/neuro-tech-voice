import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Scale } from '../scenes/Scale';

registerRoot(devRoot('scale', Scale));
