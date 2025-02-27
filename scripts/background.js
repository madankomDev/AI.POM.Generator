// background.js

// Store DOM analysis results
let currentDOMAnalysis = null;

// Store AI-enhanced POM results
let currentPOM = null;

// API endpoint for AI processing (you'll need to implement this service)
const AI_API_ENDPOINT = "https://your-api-endpoint.com/generate-pom";

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Store initial DOM analysis from content script
  if (message.action === 'storeInitialAnalysis') {
    currentDOMAnalysis = message.data;
    return true;
  }
  
  // Request to analyze DOM from popup
  if (message.action === 'requestDOMAnalysis') {
    // If we already have the analysis, send it directly
    if (currentDOMAnalysis) {
      sendResponse(currentDOMAnalysis);
      return true;
    }
    
    // Otherwise, inject the content script and get fresh analysis
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'analyzeDOM'}, function(response) {
        currentDOMAnalysis = response;
        sendResponse(currentDOMAnalysis);
      });
    });
    return true; // Required for asynchronous sendResponse
  }
  
  // Generate POM using AI
  if (message.action === 'generatePOM') {
    const framework = message.framework; // 'selenium' or 'playwright'
    const options = message.options;
    
    if (!currentDOMAnalysis) {
      sendResponse({error: 'No DOM analysis available. Please try again.'});
      return true;
    }
    
    // Create request payload
    const payload = {
      framework: framework,
      domData: currentDOMAnalysis,
      options: options
    };
    
    // Call the AI API to generate the POM
    fetch(AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
      currentPOM = data;
      sendResponse(data);
    })
    .catch(error => {
      console.error('Error calling AI API:', error);
      
      // Fallback to local generation if API fails
      const locallyGeneratedPOM = generatePOMLocally(framework, currentDOMAnalysis, options);
      sendResponse(locallyGeneratedPOM);
    });
    
    return true; // Required for asynchronous sendResponse
  }
});

// Fallback function to generate POM locally without AI
function generatePOMLocally(framework, domData, options) {
  // This is a simplified version that doesn't use AI
  // In a real implementation, you'd want to use your AI service
  
  let pomCode = '';
  const className = generateClassName(domData.title);
  
  if (framework === 'selenium') {
    pomCode = generateSeleniumPOM(className, domData, options);
  } else {
    pomCode = generatePlaywrightPOM(className, domData, options);
  }
  
  return {
    code: pomCode,
    framework: framework,
    className: className
  };
}

// Generate a C# class name from the page title
function generateClassName(title) {
  // Remove non-alphanumeric characters and convert to PascalCase
  return 'Page' + title
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
    .replace(/\s+/g, '');
}

// Generate Selenium C# POM
function generateSeleniumPOM(className, domData, options) {
  let code = `using OpenQA.Selenium;\nusing OpenQA.Selenium.Support.UI;\nusing System;\n\nnamespace YourNamespace.Pages\n{\n    /// <summary>\n    /// Page Object Model for ${domData.title}\n    /// URL: ${domData.url}\n    /// </summary>\n    public class ${className}\n    {\n        private IWebDriver _driver;\n        private WebDriverWait _wait;\n\n        public ${className}(IWebDriver driver)\n        {\n            _driver = driver;\n            _wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));\n        }\n\n`;
  
  // Add element locators
  domData.elements.forEach((element, index) => {
    const elementName = generateElementName(element, index);
    const locator = convertToSeleniumLocator(element.recommended);
    
    if (options.includeComments) {
      code += `        // ${element.purpose === 'interaction' ? 'Interactive element' : 'Data element'}: ${element.element.tagName}${element.element.textContent ? ' with text "' + truncateText(element.element.textContent, 30) + '"' : ''}\n`;
    }
    
    code += `        private By ${elementName}Locator => ${locator};\n`;
    
    // Add getter for the element
    code += `        public IWebElement ${elementName} => _driver.FindElement(${elementName}Locator);\n\n`;
  });
  
  // Add interaction methods if requested
  if (options.generateMethods) {
    domData.elements.forEach((element, index) => {
      if (element.purpose === 'interaction') {
        const elementName = generateElementName(element, index);
        generateSeleniumInteractionMethod(code, element, elementName);
      } else {
        const elementName = generateElementName(element, index);
        generateSeleniumGetTextMethod(code, element, elementName);
      }
    });
  }
  
  code += '    }\n}';
  return code;
}

// Generate Playwright C# POM
function generatePlaywrightPOM(className, domData, options) {
  let code = `using Microsoft.Playwright;\nusing System.Threading.Tasks;\n\nnamespace YourNamespace.Pages\n{\n    /// <summary>\n    /// Page Object Model for ${domData.title}\n    /// URL: ${domData.url}\n    /// </summary>\n    public class ${className}\n    {\n        private IPage _page;\n\n        public ${className}(IPage page)\n        {\n            _page = page;\n        }\n\n`;
  
  // Add element locators
  domData.elements.forEach((element, index) => {
    const elementName = generateElementName(element, index);
    const locator = convertToPlaywrightLocator(element.recommended);
    
    if (options.includeComments) {
      code += `        // ${element.purpose === 'interaction' ? 'Interactive element' : 'Data element'}: ${element.element.tagName}${element.element.textContent ? ' with text "' + truncateText(element.element.textContent, 30) + '"' : ''}\n`;
    }
    
    code += `        private string ${elementName}Selector => ${locator};\n`;
  });
  
  code += '\n';
  
  // Add interaction methods if requested
  if (options.generateMethods) {
    domData.elements.forEach((element, index) => {
      if (element.purpose === 'interaction') {
        const elementName = generateElementName(element, index);
        generatePlaywrightInteractionMethod(code, element, elementName);
      } else {
        const elementName = generateElementName(element, index);
        generatePlaywrightGetTextMethod(code, element, elementName);
      }
    });
  }
  
  code += '    }\n}';
  return code;
}

// Helper functions would be implemented here
// Like convertToSeleniumLocator, convertToPlaywrightLocator, generateElementName, etc.

// This is just a placeholder - in a real implementation these would be fleshed out properly
function generateElementName(element, index) {
  // Simplified version - would be more intelligent in real implementation
  if (element.element.textContent && element.element.textContent.trim() !== '') {
    return 'element' + index;
  }
  return 'element' + index;
}

function convertToSeleniumLocator(recommended) {
  // Simplified version - would handle all cases in real implementation
  return 'By.Id("example")';
}

function convertToPlaywrightLocator(recommended) {
  // Simplified version - would handle all cases in real implementation
  return '"#example"';
}

function generateSeleniumInteractionMethod(code, element, elementName) {
  // Simplified version - would be more specific to element type in real implementation
  code += '        // Placeholder for interaction method\n';
}

function generateSeleniumGetTextMethod(code, element, elementName) {
  // Simplified version - would be more specific to element type in real implementation
  code += '        // Placeholder for get text method\n';
}

function generatePlaywrightInteractionMethod(code, element, elementName) {
  // Simplified version - would be more specific to element type in real implementation
  code += '        // Placeholder for interaction method\n';
}

function generatePlaywrightGetTextMethod(code, element, elementName) {
  // Simplified version - would be more specific to element type in real implementation
  code += '        // Placeholder for get text method\n';
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle copy to clipboard request if needed
  if (message.action === 'copyToClipboard') {
    const textArea = document.createElement('textarea');
    textArea.value = message.text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    sendResponse({success: true});
    return true;
  }
  
  return false;
});