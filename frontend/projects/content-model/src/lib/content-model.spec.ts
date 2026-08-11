import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContentModel } from './content-model';

describe('ContentModel', () => {
  let component: ContentModel;
  let fixture: ComponentFixture<ContentModel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentModel],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentModel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
