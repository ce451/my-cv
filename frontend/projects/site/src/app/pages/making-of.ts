import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UI } from '../ui/ui-text';

@Component({
  selector: 'app-making-of',
  imports: [RouterLink],
  templateUrl: './making-of.html',
})
export class MakingOf {
  protected readonly ui = UI;
}
