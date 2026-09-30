import { registerRoot } from 'remotion';
import { devRoot } from './devRoot';
import { Twist } from '../scenes/Twist';

registerRoot(devRoot('twist', Twist));
