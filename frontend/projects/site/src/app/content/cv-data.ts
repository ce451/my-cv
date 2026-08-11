import { PublicCv } from 'content-model';
import cvJson from '../../../../../../content/cv.de.json';

/** Published CV content, baked in at build time. Single source: content/cv.de.json. */
export const CV: PublicCv = cvJson as PublicCv;
