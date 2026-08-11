import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UI } from '../ui/ui-text';

@Component({
  selector: 'app-now',
  imports: [RouterLink],
  templateUrl: './now.html',
})
export class Now {
  protected readonly ui = UI;
}
