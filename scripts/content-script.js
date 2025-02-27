// content-script.js

// This script is responsible for analyzing the DOM and collecting element information

// Store all analyzed elements for POM generation
let analyzedElements = [];

// Function to determine the best locator strategy for an element
function determineBestLocator(element) {
  const locators = {};
  
  // Check for ID (usually the most reliable)
  if (element.id) {
    locators.id = element.id;
  }
  
  // Check for name attribute
  if (element.name) {
    locators.name = element.name;
  }
  
  // Check for data-testid or similar test attributes
  if (element.dataset && element.dataset.testid) {
    locators.testId = element.dataset.testid;
  } else if (element.dataset && element.dataset.test) {
    locators.testId = element.dataset.test;
  } else if (element.dataset && element.dataset.automation) {
    locators.testId = element.dataset.automation;
  }
  
  // Check for classes (may be less reliable if classes change frequently)
  if (element.className && typeof element.className === 'string' && element.className.trim() !== '') {
    locators.className = element.className.trim().split(/\s+/);
  }
  
  // Get text content for link text or partial link text (for links)
  if (element.tagName === 'A' && element.textContent && element.textContent.trim() !== '') {
    locators.linkText = element.textContent.trim();
  }
  
  // XPath (as a last resort, can be brittle)
  locators.xpath = generateXPath(element);
  
  // CSS Selector
  locators.cssSelector = generateCssSelector(element);
  
  // Return all locator options with a recommendation
  return {
    element: {
      tagName: element.tagName.toLowerCase(),
      type: element.type || null,
      isVisible: isElementVisible(element),
      isInteractive: isInteractive(element),
      textContent: element.textContent ? element.textContent.trim() : ''
    },
    locators: locators,
    recommended: determineRecommendedLocator(locators, element)
  };
}

// Generate a CSS selector for the element
function generateCssSelector(element) {
  // Start with the tag name
  let selector = element.tagName.toLowerCase();
  
  // Add ID if available
  if (element.id) {
    return `${selector}#${element.id}`;
  }
  
  // Add specific attributes for form elements
  if (element.name) {
    selector += `[name="${element.name}"]`;
  }
  
  if (element.type) {
    selector += `[type="${element.type}"]`;
  }
  
  return selector;
}

// Generate an XPath for the element
function generateXPath(element) {
  // This is a simplified XPath generator, a real implementation would be more robust
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  let path = '';
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    const pathIndex = index === 0 ? '' : `[${index + 1}]`;
    path = `/${tagName}${pathIndex}${path}`;
    
    current = current.parentNode;
  }
  
  return path === '' ? '/' : path;
}

// Determine if an element is visible
function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

// Determine if an element is interactive
function isInteractive(element) {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
  
  if (interactiveTags.includes(element.tagName.toLowerCase())) {
    return true;
  }
  
  if (element.getAttribute('role') === 'button' || 
      element.getAttribute('role') === 'link' ||
      element.getAttribute('role') === 'checkbox' ||
      element.getAttribute('role') === 'menuitem') {
    return true;
  }
  
  if (element.onclick || element.addEventListener) {
    return true;
  }
  
  return false;
}

// Determine the recommended locator based on reliability and maintainability
function determineRecommendedLocator(locators, element) {
  // Prioritize locators in order of reliability
  if (locators.id) {
    return { type: 'id', value: locators.id };
  }
  
  if (locators.testId) {
    return { type: 'data-testid', value: locators.testId };
  }
  
  if (locators.name) {
    return { type: 'name', value: locators.name };
  }
  
  if (element.tagName === 'A' && locators.linkText && locators.linkText.length < 50) {
    return { type: 'linkText', value: locators.linkText };
  }
  
  if (locators.cssSelector) {
    return { type: 'cssSelector', value: locators.cssSelector };
  }
  
  // XPath as last resort
  return { type: 'xpath', value: locators.xpath };
}

// Analyze the whole DOM
function analyzeDOM() {
  analyzedElements = [];
  
  // Get all interactive and important elements
  const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"]');
  
  // Get all elements that display important data (spans, divs with content, etc.)
  const dataElements = document.querySelectorAll('span, p, h1, h2, h3, h4, h5, h6, td, th, dd, dt, li');
  
  // Analyze interactive elements
  interactiveElements.forEach(element => {
    if (isElementVisible(element)) {
      analyzedElements.push({
        ...determineBestLocator(element),
        purpose: 'interaction'
      });
    }
  });
  
  // Analyze data elements
  dataElements.forEach(element => {
    if (isElementVisible(element) && element.textContent && element.textContent.trim() !== '') {
      analyzedElements.push({
        ...determineBestLocator(element),
        purpose: 'data'
      });
    }
  });
  
  // Return the analyzed elements
  return {
    url: window.location.href,
    title: document.title,
    elements: analyzedElements
  };
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeDOM') {
    const domData = analyzeDOM();
    sendResponse(domData);
  }
  return true; // Required to use sendResponse asynchronously
});

// Optional: Analyze the DOM when the content script loads
const initialAnalysis = analyzeDOM();
// Store the initial analysis for later use
chrome.runtime.sendMessage({ action: 'storeInitialAnalysis', data: initialAnalysis });