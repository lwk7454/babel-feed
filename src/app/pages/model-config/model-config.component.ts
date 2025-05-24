import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule

// PrimeNG Modules (example, adjust as needed for actual content)
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DropdownModule } from 'primeng/dropdown'; // Added DropdownModule
import { SliderModule } from 'primeng/slider';     // Added SliderModule
import { CheckboxModule } from 'primeng/checkbox'; // Added CheckboxModule


@Component({
  selector: 'app-model-config',
  standalone: true,
  imports: [
    FormsModule, // Add FormsModule here
    PanelModule,
    ButtonModule,
    ToolbarModule,
    DropdownModule, // Added DropdownModule
    SliderModule,   // Added SliderModule
    CheckboxModule  // Added CheckboxModule
  ],
  templateUrl: './model-config.component.html',
  styleUrls: ['./model-config.component.scss']
})
export class ModelConfigComponent implements OnInit {
  value: number = 0.5; // Example for p-slider
  safeSearchEnabled: boolean = false; // Example for p-checkbox

  constructor(private router: Router) { }

  ngOnInit(): void {
    // Initialization logic for model configurations if any
    console.log('ModelConfigComponent initialized.');
  }

  saveConfiguration(): void {
    // Placeholder for saving model configuration
    alert('Model configuration saved (placeholder).');
    // Potentially navigate away or show success message
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/settings']); // Fallback to settings or another appropriate route
    }
  }
}
