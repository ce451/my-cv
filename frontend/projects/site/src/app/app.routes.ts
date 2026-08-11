import { Routes } from '@angular/router';
import { Datenschutz } from './pages/datenschutz';
import { Home } from './pages/home';
import { MakingOf } from './pages/making-of';

export const routes: Routes = [
  { path: '', component: Home, title: 'Christopher Elstner — Senior Full-Stack Softwareentwickler' },
  { path: 'making-of', component: MakingOf, title: 'Making-of — Christopher Elstner' },
  { path: 'datenschutz', component: Datenschutz, title: 'Datenschutz — Christopher Elstner' },
  { path: '**', redirectTo: '' },
];
