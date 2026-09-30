import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Hook } from '../scenes/Hook';

registerRoot(devRoot('hook', Hook));
