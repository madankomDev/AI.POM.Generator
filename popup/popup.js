// popup.js

document.addEventListener('DOMContentLoaded', function() {
  // Get references to DOM elements
  const frameworkSelect = document.getElementById('framework');
  const generateMethodsCheckbox = document.getElementById('generate-methods');
  const includeCommentsCheckbox = document.getElementById('include-comments');
  const smartNamingCheckbox = document.getElementById('smart-naming');
  const generateButton = document.getElementById('generate-button');
  const statusElement = document.getElementById('status');
  const resultContainer = document.getElementById('result-container');
  const resultCode = document.getElementById('result-code');
  const copyButton = document.getElementById('copy-button');
  const downloadButton = document.getElementById('download-button');
  
  // AI-related elements
  const useAiCheckbox = document.getElementById('use-ai');
  const aiSettings = document.getElementById('ai-settings');
  const aiProviderSelect = document.getElementById('ai-provider');
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model');
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  
  // Toggle AI settings visibility when the checkbox is clicked
  useAiCheckbox.addEventListener('change', function() {
    aiSettings.style.display = this.checked ? 'block' : 'none';
  });
  
  // Toggle model options based on selected provider
  aiProviderSelect.addEventListener('change', function() {
    const openaiModels = document.querySelectorAll('.openai-model');
    const googleModels = document.querySelectorAll('.google-model');
    
    if (this.value === 'openai') {
      openaiModels.forEach(option => option.style.display = 'block');
      googleModels.forEach(option => option.style.display = 'none');
      modelSelect.value = 'gpt-4';
    } else {
      openaiModels.forEach(option => option.style.display = 'none');
      googleModels.forEach(option => option.style.display = 'block');
      modelSelect.value = 'gemini-pro';
    }
  });
  
  // Load saved API key if any
  chrome.storage.local.get(['apiKey', 'apiProvider'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      saveApiKeyCheckbox.checked = true;
    }
    
    if (result.apiProvider) {
      aiProviderSelect.value = result.apiProvider;
      // Trigger change event to update model options
      aiProviderSelect.dispatchEvent(new Event('change'));
    }
  });
  
  // Event listener for generate button
  generateButton.addEventListener('click', function() {
    // Show generating status
    statusElement.textContent = 'Analyzing page and generating POM...';
    statusElement.className = 'status status-processing';
    
    // Hide any previous results
    resultContainer.style.display = 'none';
    
    // Save API key if requested
    if (useAiCheckbox.checked && saveApiKeyCheckbox.checked) {
      chrome.storage.local.set({
        apiKey: apiKeyInput.value,
        apiProvider: aiProviderSelect.value
      });
    } else if (!saveApiKeyCheckbox.checked) {
      chrome.storage.local.remove(['apiKey', 'apiProvider']);
    }
    
    // Collect options
    const options = {
      generateMethods: generateMethodsCheckbox.checked,
      includeComments: includeCommentsCheckbox.checked,
      smartNaming: smartNamingCheckbox.checked,
      useAi: useAiCheckbox.checked,
      aiProvider: aiProviderSelect.value,
      apiKey: apiKeyInput.value,
      model: modelSelect.value
    };
    
    // Get the current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusElement.textContent = 'Cannot access the current tab. Please try again.';
        statusElement.className = 'status status-error';
        return;
      }
      
      const activeTab = tabs[0];
      
      // Execute content script in the active tab to analyze DOM
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: function() {
          // This function runs in the context of the page
          // We'll collect information about the DOM elements
          
          function analyzeDOM() {
            // Get all interactive elements
            const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"]');
            
            // Get all elements that display important data
            const dataElements = document.querySelectorAll('span, p, h1, h2, h3, h4, h5, h6, td, th, dd, dt, li');
            
            // Analyze elements
            const analyzedElements = [];
            
            // Process interactive elements
            interactiveElements.forEach(el => {
              if (isElementVisible(el)) {
                analyzedElements.push({
                  tagName: el.tagName.toLowerCase(),
                  id: el.id || null,
                  name: el.name || null,
                  type: el.type || null,
                  classes: Array.from(el.classList).join(' ') || null,
                  text: el.textContent ? el.textContent.trim() : null,
                  attributes: getElementAttributes(el),
                  isInteractive: true,
                  purpose: 'interaction'
                });
              }
            });
            
            // Process data elements
            dataElements.forEach(el => {
              if (isElementVisible(el) && el.textContent && el.textContent.trim() !== '') {
                analyzedElements.push({
                  tagName: el.tagName.toLowerCase(),
                  id: el.id || null,
                  name: el.name || null,
                  classes: Array.from(el.classList).join(' ') || null,
                  text: el.textContent ? el.textContent.trim() : null,
                  attributes: getElementAttributes(el),
                  isInteractive: false,
                  purpose: 'data'
                });
              }
            });
            
            // Return the element data along with page info
            return {
              url: window.location.href,
              title: document.title,
              elements: analyzedElements
            };
          }
          
          // Check if an element is visible
          function isElementVisible(el) {
            if (!el.getBoundingClientRect) {
              return false;
            }
            
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            
            return style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  rect.width > 0 &&
                  rect.height > 0;
          }
          
          // Get important attributes for an element
          function getElementAttributes(el) {
            const result = {};
            
            // List of attributes to capture
            const importantAttrs = [
              'id', 'class', 'name', 'type', 'value', 'href', 'src',
              'alt', 'title', 'aria-label', 'data-testid', 'role',
              'placeholder', 'for'
            ];
            
            // Get all data-* attributes
            for (let i = 0; i < el.attributes.length; i++) {
              const attr = el.attributes[i];
              if (attr.name.startsWith('data-')) {
                result[attr.name] = attr.value;
              } else if (importantAttrs.includes(attr.name)) {
                result[attr.name] = attr.value;
              }
            }
            
            return result;
          }
          
          return analyzeDOM();
        }
      }, function(results) {
        if (chrome.runtime.lastError) {
          statusElement.textContent = 'Error analyzing page: ' + chrome.runtime.lastError.message;
          statusElement.className = 'status status-error';
          return;
        }
        
        if (!results || results.length === 0) {
          statusElement.textContent = 'Failed to analyze page content.';
          statusElement.className = 'status status-error';
          return;
        }
        
        const domData = results[0].result;
        
        // If AI is enabled and we have an API key, use the AI API
        if (options.useAi && options.apiKey) {
          // Call AI API based on the provider
          generatePOMWithAI(domData, options, function(response) {
            if (response.error) {
              statusElement.textContent = 'Error from AI API: ' + response.error;
              statusElement.className = 'status status-error';
              return;
            }
            
            displayResult(response.code, domData.title);
          });
        } else {
          // Generate POM locally
          let pomCode = '';
          
          if (options.framework === 'selenium') {
            pomCode = generateSeleniumPOM(domData, options);
          } else {
            pomCode = generatePlaywrightPOM(domData, options);
          }
          
          displayResult(pomCode, domData.title);
        }
      });
    });
  });
  
  // Function to generate POM using AI
  function generatePOMWithAI(domData, options, callback) {
    const framework = options.framework;
    const apiKey = options.apiKey;
    
    // Status update
    statusElement.textContent = `Sending data to ${options.aiProvider} API...`;
    
    // Create a prompt for the AI
    let prompt = `Generate a C# Page Object Model for ${framework} using the following page structure:\n\n`;
    prompt += `URL: ${domData.url}\n`;
    prompt += `Title: ${domData.title}\n\n`;
    prompt += `Elements on the page:\n`;
    
    domData.elements.forEach((el, index) => {
      prompt += `Element ${index + 1}: ${el.tagName}`;
      if (el.id) prompt += `, id="${el.id}"`;
      if (el.name) prompt += `, name="${el.name}"`;
      if (el.type) prompt += `, type="${el.type}"`;
      if (el.text && el.text.length < 50) prompt += `, text="${el.text}"`;
      prompt += `, purpose="${el.purpose}"\n`;
    });
    
    prompt += `\nRequirements:\n`;
    prompt += `- Follow best practices for ${framework} C# Page Object Models\n`;
    prompt += `- ${options.generateMethods ? 'Include interaction methods for elements' : 'Only include element locators'}\n`;
    prompt += `- ${options.includeComments ? 'Add comments explaining each element' : 'Keep comments minimal'}\n`;
    prompt += `- ${options.smartNaming ? 'Use intelligent, descriptive names for elements' : 'Use simple naming for elements'}\n`;
    prompt += `- Ensure proper C# syntax and formatting\n`;
    prompt += `- Only return the code, no explanations\n`;
    
    if (options.aiProvider === 'openai') {
      callOpenAI(prompt, options.model, apiKey, callback);
    } else {
      callGoogleAI(prompt, options.model, apiKey, callback);
    }
  }
  
  // Function to call OpenAI API
  function callOpenAI(prompt, model, apiKey, callback) {
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert test automation engineer specializing in creating Page Object Models. Generate only the code without any explanation or markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.choices && data.choices.length > 0) {
        const code = data.choices[0].message.content.trim();
        callback({ code: code });
      } else {
        callback({ error: 'Unexpected response format from OpenAI API' });
      }
    })
    .catch(error => {
      console.error('Error calling OpenAI API:', error);
      callback({ error: error.message });
    });
  }
  
  // Function to call Google AI API
  function callGoogleAI(prompt, model, apiKey, callback) {
    // Google Gemini API endpoint
    const apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/';
    const fullEndpoint = `${apiEndpoint}${model}:generateContent?key=${apiKey}`;
    
    fetch(fullEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text;
        callback({ code: text });
      } else {
        callback({ error: 'Unexpected response format from Google AI API' });
      }
    })
    .catch(error => {
      console.error('Error calling Google AI API:', error);
      callback({ error: error.message });
    });
  }
  
  // Function to display the generated code
  function displayResult(code, pageTitle) {
    resultCode.textContent = code;
    resultContainer.style.display = 'block';
    statusElement.textContent = 'POM successfully generated!';
    statusElement.className = 'status status-success';
    
    // Store the generated code for download
    resultCode.dataset.className = pageTitle.replace(/[^a-zA-Z0-9]/g, '') + "Page";
    resultCode.dataset.framework = frameworkSelect.value;
  }
  
  // Function to generate a Selenium C# POM locally
  function generateSeleniumPOM(domData, options) {
    const className = domData.title.replace(/[^a-zA-Z0-9]/g, '') + "Page";
    
    let code = `using OpenQA.Selenium;\nusing OpenQA.Selenium.Support.UI;\nusing System;\n\nnamespace YourNamespace.Pages\n{\n    /// <summary>\n    /// Page Object Model for ${domData.title}\n    /// URL: ${domData.url}\n    /// </summary>\n    public class ${className}\n    {\n        private IWebDriver _driver;\n        private WebDriverWait _wait;\n\n        public ${className}(IWebDriver driver)\n        {\n            _driver = driver;\n            _wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));\n        }\n\n`;
    
    // Add element locators
    domData.elements.forEach((element, index) => {
      const elementName = generateElementName(element, index, options.smartNaming);
      const locator = generateSeleniumLocator(element);
      
      if (options.includeComments) {
        code += `        // ${element.purpose === 'interaction' ? 'Interactive element' : 'Data element'}: ${element.tagName}${element.text ? ' with text "' + truncateText(element.text, 30) + '"' : ''}\n`;
      }
      
      code += `        private By ${elementName}Locator => ${locator};\n`;
      code += `        public IWebElement ${elementName} => _driver.FindElement(${elementName}Locator);\n\n`;
      
      // Add interaction methods if requested
      if (options.generateMethods) {
        if (element.purpose === 'interaction') {
          if (element.tagName === 'input') {
            if (element.type === 'text' || element.type === 'email' || element.type === 'password') {
              code += `        /// <summary>\n        /// Enter text in the ${elementName}\n        /// </summary>\n        public ${className} Enter${elementName.replace('Input', '')}(string text)\n        {\n            ${elementName}.Clear();\n            ${elementName}.SendKeys(text);\n            return this;\n        }\n\n`;
            } else if (element.type === 'checkbox' || element.type === 'radio') {
              code += `        /// <summary>\n        /// Click the ${elementName}\n        /// </summary>\n        public ${className} Click${elementName}()\n        {\n            ${elementName}.Click();\n            return this;\n        }\n\n`;
              code += `        /// <summary>\n        /// Check if the ${elementName} is selected\n        /// </summary>\n        public bool Is${elementName}Selected()\n        {\n            return ${elementName}.Selected;\n        }\n\n`;
            } else if (element.type === 'submit') {
              code += `        /// <summary>\n        /// Click the ${elementName}\n        /// </summary>\n        public void Click${elementName}()\n        {\n            ${elementName}.Click();\n        }\n\n`;
            }
          } else if (element.tagName === 'button' || element.tagName === 'a') {
            code += `        /// <summary>\n        /// Click the ${elementName}\n        /// </summary>\n        public void Click${elementName}()\n        {\n            ${elementName}.Click();\n        }\n\n`;
          } else if (element.tagName === 'select') {
            code += `        /// <summary>\n        /// Select option by visible text in the ${elementName}\n        /// </summary>\n        public ${className} Select${elementName}ByText(string text)\n        {\n            new SelectElement(${elementName}).SelectByText(text);\n            return this;\n        }\n\n`;
            code += `        /// <summary>\n        /// Select option by value in the ${elementName}\n        /// </summary>\n        public ${className} Select${elementName}ByValue(string value)\n        {\n            new SelectElement(${elementName}).SelectByValue(value);\n            return this;\n        }\n\n`;
          }
        } else {
          code += `        /// <summary>\n        /// Get text from the ${elementName}\n        /// </summary>\n        public string Get${elementName}Text()\n        {\n            return ${elementName}.Text;\n        }\n\n`;
        }
      }
    });
    
    code += `        /// <summary>\n        /// Navigate to the page\n        /// </summary>\n        public ${className} NavigateTo()\n        {\n            _driver.Navigate().GoToUrl("${domData.url}");\n            return this;\n        }\n\n`;
    
    code += `        /// <summary>\n        /// Wait for page to load completely\n        /// </summary>\n        public ${className} WaitForPageToLoad()\n        {\n            _wait.Until(d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState").Equals("complete"));\n            return this;\n        }\n    }\n}`;
    
    return code;
  }
  
  // Function to generate a Playwright C# POM locally
  function generatePlaywrightPOM(domData, options) {
    const className = domData.title.replace(/[^a-zA-Z0-9]/g, '') + "Page";
    
    let code = `using Microsoft.Playwright;\nusing System.Threading.Tasks;\n\nnamespace YourNamespace.Pages\n{\n    /// <summary>\n    /// Page Object Model for ${domData.title}\n    /// URL: ${domData.url}\n    /// </summary>\n    public class ${className}\n    {\n        private IPage _page;\n\n        public ${className}(IPage page)\n        {\n            _page = page;\n        }\n\n`;
    
    // Add element selectors
    domData.elements.forEach((element, index) => {
      const elementName = generateElementName(element, index, options.smartNaming);
      const selector = generatePlaywrightSelector(element);
      
      if (options.includeComments) {
        code += `        // ${element.purpose === 'interaction' ? 'Interactive element' : 'Data element'}: ${element.tagName}${element.text ? ' with text "' + truncateText(element.text, 30) + '"' : ''}\n`;
      }
      
      code += `        private string ${elementName}Selector => ${selector};\n\n`;
      
      // Add interaction methods if requested
      if (options.generateMethods) {
        if (element.purpose === 'interaction') {
          if (element.tagName === 'input') {
            if (element.type === 'text' || element.type === 'email' || element.type === 'password') {
              code += `        /// <summary>\n        /// Enter text in the ${elementName}\n        /// </summary>\n        public async Task<${className}> Enter${elementName.replace('Input', '')}Async(string text)\n        {\n            await _page.FillAsync(${elementName}Selector, text);\n            return this;\n        }\n\n`;
            } else if (element.type === 'checkbox' || element.type === 'radio') {
              code += `        /// <summary>\n        /// Check the ${elementName}\n        /// </summary>\n        public async Task<${className}> Check${elementName}Async(bool check = true)\n        {\n            if (check)\n                await _page.CheckAsync(${elementName}Selector);\n            else\n                await _page.UncheckAsync(${elementName}Selector);\n            return this;\n        }\n\n`;
              code += `        /// <summary>\n        /// Check if the ${elementName} is checked\n        /// </summary>\n        public async Task<bool> Is${elementName}CheckedAsync()\n        {\n            return await _page.IsCheckedAsync(${elementName}Selector);\n        }\n\n`;
            } else if (element.type === 'submit') {
              code += `        /// <summary>\n        /// Click the ${elementName}\n        /// </summary>\n        public async Task Click${elementName}Async()\n        {\n            await _page.ClickAsync(${elementName}Selector);\n        }\n\n`;
            }
          } else if (element.tagName === 'button' || element.tagName === 'a') {
            code += `        /// <summary>\n        /// Click the ${elementName}\n        /// </summary>\n        public async Task Click${elementName}Async()\n        {\n            await _page.ClickAsync(${elementName}Selector);\n        }\n\n`;
          } else if (element.tagName === 'select') {
            code += `        /// <summary>\n        /// Select option by visible text in the ${elementName}\n        /// </summary>\n        public async Task<${className}> Select${elementName}ByTextAsync(string text)\n        {\n            await _page.SelectOptionAsync(${elementName}Selector, new SelectOptionValue { Label = text });\n            return this;\n        }\n\n`;
            code += `        /// <summary>\n        /// Select option by value in the ${elementName}\n        /// </summary>\n        public async Task<${className}> Select${elementName}ByValueAsync(string value)\n        {\n            await _page.SelectOptionAsync(${elementName}Selector, new SelectOptionValue { Value = value });\n            return this;\n        }\n\n`;
          }
        } else {
          code += `        /// <summary>\n        /// Get text from the ${elementName}\n        /// </summary>\n        public async Task<string> Get${elementName}TextAsync()\n        {\n            return await _page.TextContentAsync(${elementName}Selector);\n        }\n\n`;
        }
      }
    });
    
    code += `        /// <summary>\n        /// Navigate to the page\n        /// </summary>\n        public async Task NavigateAsync()\n        {\n            await _page.GotoAsync("${domData.url}");\n        }\n\n`;
    
    code += `        /// <summary>\n        /// Wait for page to load completely\n        /// </summary>\n        public async Task<${className}> WaitForPageToLoadAsync()\n        {\n            await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);\n            return this;\n        }\n    }\n}`;
    
    return code;
  }
  
  // Helper function to generate element names
  function generateElementName(element, index, smartNaming) {
    if (!smartNaming) {
      return element.tagName.charAt(0).toUpperCase() + element.tagName.slice(1) + index;
    }
    
    // Try to generate a smart name based on element properties
    if (element.id) {
      return formatElementName(element.id);
    }
    
    if (element.name) {
      return formatElementName(element.name);
    }
    
    if (element.attributes && element.attributes['data-testid']) {
      return formatElementName(element.attributes['data-testid']);
    }
    
    if (element.attributes && element.attributes['aria-label']) {
      return formatElementName(element.attributes['aria-label']);
    }
    
    if (element.text && element.text.length < 30) {
      return formatElementName(element.text);
    }
    
    // Fallback to generic name
    const prefix = element.purpose === 'interaction' ? (getElementTypePrefix(element) || element.tagName) : element.tagName;
    return formatElementName(prefix) + index;
  }
  
  // Format element name to PascalCase
  function formatElementName(name) {
    // Remove non-alphanumeric characters
    const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, ' ');
    
    // Convert to PascalCase
    return cleanName
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  
  // Get a prefix based on element type for better naming
  function getElementTypePrefix(element) {
    if (element.tagName === 'input') {
      if (element.type === 'text' || element.type === 'email' || element.type === 'password' || !element.type) {
        return 'Input';
      } else if (element.type === 'checkbox') {
        return 'Checkbox';
      } else if (element.type === 'radio') {
        return 'Radio';
      } else if (element.type === 'submit') {
        return 'Button';
      }
    } else if (element.tagName === 'button') {
      return 'Button';
    } else if (element.tagName === 'a') {
      return 'Link';
    } else if (element.tagName === 'select') {
      return 'Dropdown';
    }
    
    return null;
  }
  
  // Helper function to generate Selenium locators
  function generateSeleniumLocator(element) {
    // Prioritize locator strategies by reliability
    if (element.id) {
      return `By.Id("${element.id}")`;
    }
    
    if (element.attributes && element.attributes['data-testid']) {
      return `By.CssSelector("[data-testid='${element.attributes['data-testid']}']")`;
    }
    
    if (element.name) {
      return `By.Name("${element.name}")`;
    }
    
    if (element.tagName === 'a' && element.text && element.text.length < 50) {
      return `By.LinkText("${truncateText(element.text, 50)}")`;
    }
    
    // CSS selector with multiple attributes for better uniqueness
    let cssSelector = element.tagName;
    
    if (element.type) {
      cssSelector += `[type='${element.type}']`;
    }
    
    if (element.classes) {
      // Add the first class to the selector
      const firstClass = element.classes.split(' ')[0];
      if (firstClass) {
        cssSelector += `.${firstClass}`;
      }
    }
    
    // Add an additional attribute if available
    if (element.attributes) {
      for (const [key, value] of Object.entries(element.attributes)) {
        if (key !== 'id' && key !== 'class' && key !== 'type' && key !== 'name' && key.startsWith('data-')) {
          cssSelector += `[${key}='${value}']`;
          break;
        }
      }
    }
    
    return `By.CssSelector("${cssSelector}")`;
  }
  
  // Helper function to generate Playwright selectors
  function generatePlaywrightSelector(element) {
    // Prioritize locator strategies by reliability
    if (element.id) {
      return `"#${element.id}"`;
    }
    
    if (element.attributes && element.attributes['data-testid']) {
      return `"[data-testid='${element.attributes['data-testid']}']"`;
    }
    
    if (element.name) {
      return `"[name='${element.name}']"`;
    }
    
    if (element.tagName === 'a' && element.text && element.text.length < 50) {
      return `"text=${truncateText(element.text, 50)}"`;
    }
    
    // CSS selector with multiple attributes for better uniqueness
    let cssSelector = element.tagName;
    
    if (element.type) {
      cssSelector += `[type='${element.type}']`;
    }
    
    if (element.classes) {
      // Add the first class to the selector
      const firstClass = element.classes.split(' ')[0];
      if (firstClass) {
        cssSelector += `.${firstClass}`;
      }
    }
    
    // Add an additional attribute if available
    if (element.attributes) {
      for (const [key, value] of Object.entries(element.attributes)) {
        if (key !== 'id' && key !== 'class' && key !== 'type' && key !== 'name' && key.startsWith('data-')) {
          cssSelector += `[${key}='${value}']`;
          break;
        }
      }
    }
    
    return `"${cssSelector}"`;
  }
  
  // Helper function to truncate text
  function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  // Direct implementation for copy button
  copyButton.addEventListener('click', function() {
    try {
      // Get the code text
      const codeText = resultCode.textContent;
      
      // Create a textarea element and set its value to the code
      const textarea = document.createElement('textarea');
      textarea.value = codeText;
      document.body.appendChild(textarea);
      
      // Select the text
      textarea.select();
      textarea.setSelectionRange(0, 99999); // For mobile devices
      
      // Execute copy command and remove the textarea
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      // Update button text
      const originalText = copyButton.textContent;
      copyButton.textContent = successful ? 'Copied!' : 'Failed to copy';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
      
      console.log(successful ? 'Text copied to clipboard' : 'Copy failed');
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Copy failed. Please select the text and copy manually.');
    }
  });
  
  // Direct implementation for download button
  downloadButton.addEventListener('click', function() {
    try {
      // Get the code and filename
      const code = resultCode.textContent;
      const className = resultCode.dataset.className || 'PageObject';
      const filename = `${className}.cs`;
      
      // Create a data URI from the code
      const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(code);
      
      // Create a link element and set download attributes
      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      
      // Add to document, click and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Download initiated for', filename);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please copy the code and save it manually.');
    }
  });
});