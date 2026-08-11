import { Routes } from '@angular/router';
import { Datenschutz } from './pages/datenschutz';
import { Home } from './pages/home';
import { MakingOf } from './pages/making-of';
import { Now } from './pages/now';
import { Uses } from './pages/uses';

export const routes: Routes = [
  { path: '', component: Home, title: 'Christopher Elstner — Full-Stack Softwareentwickler' },
  { path: 'now', component: Now, title: 'Now — Christopher Elstner' },
  { path: 'uses', component: Uses, title: 'Uses — Christopher Elstner' },
  { path: 'making-of', component: MakingOf, title: 'Making-of — Christopher Elstner' },
  { path: 'datenschutz', component: Datenschutz, title: 'Datenschutz — Christopher Elstner' },
  { path: '**', redirectTo: '' },
];
