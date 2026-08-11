import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UI } from '../ui/ui-text';

@Component({
  selector: 'app-uses',
  imports: [RouterLink],
  templateUrl: './uses.html',
})
export class Uses {
  protected readonly ui = UI;
}
