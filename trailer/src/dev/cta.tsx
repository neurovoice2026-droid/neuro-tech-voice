import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Cta } from '../scenes/Cta';

registerRoot(devRoot('cta', Cta));
