import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UI } from '../ui/ui-text';

@Component({
  selector: 'app-datenschutz',
  imports: [RouterLink],
  templateUrl: './datenschutz.html',
})
export class Datenschutz {
  protected readonly ui = UI;
}
