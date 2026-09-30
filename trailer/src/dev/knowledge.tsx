import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Knowledge } from '../scenes/Knowledge';

registerRoot(devRoot('knowledge', Knowledge));
