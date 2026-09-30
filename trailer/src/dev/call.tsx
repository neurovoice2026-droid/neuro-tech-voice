import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Call } from '../scenes/Call';

registerRoot(devRoot('call', Call));
