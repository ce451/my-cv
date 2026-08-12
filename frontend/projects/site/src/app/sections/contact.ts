import { Component } from '@angular/core';
import { CV } from '../content/cv-data';
import { UI } from '../ui/ui-text';
import { EmailLink } from '../ui/email-link';
import { Magnetic } from '../fx/magnetic';
import { Reveal } from '../fx/reveal';

@Component({
  selector: 'app-contact',
  imports: [Magnetic, Reveal, EmailLink],
  templateUrl: './contact.html',
})
export class Contact {
  protected readonly ui = UI;
  protected readonly hasEmail = CV.profile.contacts.some((c) => c.type === 'email');
  protected readonly linkedIn = CV.profile.contacts.find((c) => c.type === 'linkedin');
}
