import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { UI } from '../ui/ui-text';
import { Magnetic } from '../fx/magnetic';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-contact',
  imports: [Magnetic, Reveal],
  templateUrl: './contact.html',
})
export class Contact {
  protected readonly ui = UI;
  protected readonly email = CV.profile.contacts.find((c) => c.type === 'email' && c.url);
  protected readonly linkedIn = CV.profile.contacts.find((c) => c.type === 'linkedin');
  protected readonly github = CV.profile.contacts.find((c) => c.type === 'github');
}
