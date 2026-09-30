import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Result } from '../scenes/Result';

registerRoot(devRoot('result', Result));
