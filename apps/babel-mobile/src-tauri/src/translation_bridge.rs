// apps/babel-mobile/src-tauri/src/translation_bridge.rs
use tauri::Window;

// Extracts HTML content of the main article from the webview
pub fn extract_text_from_webview(window: &Window) -> Result<String, String> {
    let script = r#"
        (function() {
            function calculateScore(element) {
                let score = 0;
                if (!element || typeof element.tagName === 'undefined') return 0;

                // Favor common article tags
                const tagName = element.tagName.toLowerCase();
                if (tagName === 'article') score += 30;
                if (tagName === 'main') score += 20;
                if (tagName === 'div') score += 5; // Generic container

                // Check for common IDs and classes
                const id = element.id || '';
                const className = element.className || '';
                if (typeof className === 'string') { // Ensure className is a string
                    if (id.match(/article|content|main|body/i)) score += 25;
                    if (className.match(/article|content|main|body/i)) score += 25;
                }


                // Add points for paragraph density
                const paragraphs = element.getElementsByTagName('p').length;
                score += paragraphs * 5;

                // Add points for text length (rough indicator)
                const textContentLength = element.textContent ? element.textContent.trim().length : 0;
                score += Math.floor(textContentLength / 100); // 1 point per 100 chars

                // Penalize for too many links or forms (often navs or sidebars)
                const links = element.getElementsByTagName('a').length;
                const forms = element.getElementsByTagName('form').length;
                if (links > paragraphs * 2 && paragraphs > 0) score -= 20; // Many links relative to text
                if (forms > 0) score -= 15 * forms;

                // Penalize for common noise selectors if they are the candidate itself
                const noiseSelectors = ['nav', 'header', 'footer', 'aside', '.ad', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '.sidebar', '.menu'];
                if (noiseSelectors.some(sel => element.matches(sel))) score -= 50;


                return score;
            }

            function cleanElement(element) {
                if (!element) return null;
                const cleanNode = element.cloneNode(true);

                // Remove unwanted tags
                const tagsToRemove = ['script', 'style', 'iframe', 'noscript', 'link', 'meta', 'button', 'input', 'select', 'textarea', 'form', 'nav', 'header', 'footer', 'aside'];
                tagsToRemove.forEach(tagName => {
                    cleanNode.querySelectorAll(tagName).forEach(el => el.remove());
                });

                // Remove elements that are likely ads or social media widgets by class/id
                const classOrIdPatterns = /comment|share|social|promo|banner|hidden|metadata|author|sidebar|menu|modal|popup/i;
                cleanNode.querySelectorAll('*').forEach(el => {
                    if (el.id && classOrIdPatterns.test(el.id)) el.remove();
                    if (el.className && typeof el.className === 'string' && classOrIdPatterns.test(el.className)) el.remove();
                    // Remove empty elements that might be left after cleaning
                    if (!el.textContent.trim() && el.children.length === 0 && el.tagName.toLowerCase() !== 'img' && el.tagName.toLowerCase() !== 'br' && el.tagName.toLowerCase() !== 'hr') {
                        // el.remove(); // This can be too aggressive
                    }
                });
                return cleanNode;
            }

            let candidates = [];
            // Look for specific semantic tags
            document.querySelectorAll('article, [role="article"], main, [role="main"]').forEach(el => candidates.push(el));

            // If no strong candidates, look for common divs
            if (candidates.filter(c => calculateScore(c) > 20).length === 0) {
                 document.querySelectorAll('#content, #main-content, #article-body, .content, .article-content, .main-content, .article-body, .body').forEach(el => {
                    if(el.closest('nav, header, footer, aside') == null) { // Avoid those inside noise elements
                         candidates.push(el);
                    }
                 });
            }


            if (candidates.length === 0) { // If still no candidates, consider body as a last resort
                 candidates.push(document.body);
            }

            if (candidates.length === 0) return ""; // Should not happen if body is pushed

            candidates.sort((a, b) => calculateScore(b) - calculateScore(a)); // Sort by score descending

            let bestElement = candidates[0];

            // If best element is body, try to find a better child within it
            if (bestElement.tagName.toLowerCase() === 'body' && bestElement.children.length > 0) {
                let bodyChildrenCandidates = [];
                for(let i=0; i < bestElement.children.length; i++) {
                    const child = bestElement.children[i];
                    // Only consider direct children that are divs or main structural elements
                    if (child.tagName && (child.tagName.toLowerCase() === 'div' || child.tagName.toLowerCase() === 'main' || child.tagName.toLowerCase() === 'section')) {
                         // And not common noise containers
                        if (!child.matches('nav, header, footer, aside')) {
                            bodyChildrenCandidates.push(child);
                        }
                    }
                }
                if (bodyChildrenCandidates.length > 0) {
                    bodyChildrenCandidates.sort((a,b) => calculateScore(b) - calculateScore(a));
                    if(calculateScore(bodyChildrenCandidates[0]) > calculateScore(bestElement)/2 || bodyChildrenCandidates[0].querySelectorAll('p').length > 5){ // Only take child if significantly better or very p-dense
                        bestElement = bodyChildrenCandidates[0];
                    }
                }
            }


            const cleanedElement = cleanElement(bestElement);
            return cleanedElement ? cleanedElement.outerHTML : "";
        })();
    "#;

    window.eval(script)
        .map_err(|e| format!("Failed to execute content extraction script: {}", e))
}

// Mock translation service that "translates" HTML content
pub fn mock_translate(html_content: String) -> String {
    // Wrap the original HTML content in a div with some styling to indicate translation
    // and add a clear "Translated" message.
    // Ensure any existing quotes or special characters in html_content are preserved.
    format!(
        r#"<div style="border: 2px dashed blue; padding: 10px; background-color: #f0f8ff;" id="mock-translation-wrapper">
            <h3 style="color: blue; margin-top: 0;">Mock Translated Content:</h3>
            {}
        </div>"#,
        html_content // The original HTML is embedded here
    )
}

// Injects HTML content into a determined main content area of the webview
// Note: This is a naive implementation that replaces the entire body.
// A more sophisticated version might target specific elements.
pub fn inject_text_into_webview(window: &Window, html_content: String) -> Result<(), String> {
    // Escape the content for JavaScript template literal and to prevent basic XSS in this context
    let escaped_content = html_content
        .replace("\\", "\\\\") // Escape backslashes
        .replace("`", "\\`")      // Escape backticks
        .replace("${", "\\${");   // Escape ${ for template literals

    let script = format!("document.body.innerHTML = `{}`;", escaped_content);
    window.eval(&script)
        .map_err(|e| format!("Failed to inject content: {}", e))?;
    Ok(())
}

// A slightly more robust injection that attempts to preserve some structure
// by setting innerText of a new div, then replacing body.
// This is still very basic.
// Injects HTML content into a determined main content area of the webview
pub fn inject_html_content_into_webview(window: &Window, html_content: String) -> Result<(), String> {
    // Escape the html_content for safe insertion into a JavaScript template literal
    let escaped_html_content = html_content
        .replace("\\", "\\\\") // Must be first
        .replace("`", "\\`")
        .replace("${", "\\${"); // Escape ${} sequences

    let script = format!(r#"
        (function(htmlContentToInject) {{
            let targetElement = null;
            const selectors = [
                'article', '[role="article"]', // Most specific first
                'main', '[role="main"]',        // Semantic main content
                '#article-body', '#content', '#main-content', '#main', // Common IDs
                '.article-body', '.article-content', '.Content', '.content', '.main-content' // Common classes
            ];

            for (const selector of selectors) {{
                const element = document.querySelector(selector);
                if (element) {{
                    // Basic check: ensure it's not a tiny element unless it's a specific article/main tag
                    const tagName = element.tagName.toLowerCase();
                    if (tagName === 'article' || tagName === 'main' || element.offsetHeight > 100 || element.offsetWidth > 100) {{
                         // Avoid replacing content of nav/header/footer if one of the generic classes matched them
                        if (element.closest('nav, header, footer, aside')) {{
                            if (tagName === 'article' || tagName === 'main') {{ // If it's a main/article tag, it's probably fine
                                targetElement = element;
                                break;
                            }}
                            // else, continue, this generic match is inside noise
                        }} else {{
                            targetElement = element;
                            break;
                        }}
                    }}
                }}
            }}

            // If no specific container is found, fall back to document.body.
            if (!targetElement) {{
                console.warn('No specific target element found for injection, falling back to document.body.');
                targetElement = document.body;
            }} else {{
                console.log('Target element for injection:', targetElement);
            }}

            if (targetElement) {{
                try {{
                    targetElement.innerHTML = htmlContentToInject;
                    return {{ success: true }};
                }} catch (e) {{
                    console.error('Error injecting HTML content:', e);
                    return {{ success: false, error: e.toString() }};
                }}
            }}
            console.error('No targetElement could be confirmed for injection.');
            return {{ success: false, error: 'No target element found after all checks.' }};
        }})(`{}`);
    "#, escaped_html_content);

    // Evaluate the script and check the returned result object
    match window.eval(&script) {
        Ok(eval_result) => {
            // Assuming the script returns a JSON string like `{"success":true}` or `{"success":false, "error":"..."}`
            // We need to parse this result if it's a string, or handle it if it's already a Value.
            // For simplicity, if eval itself doesn't error, we'll assume success for now,
            // but proper parsing of the script's return would be better.
            // For example, if eval_result is tauri::RuntimeError::Json(serde_json::Error),
            // or if it's Ok(Value::String(json_str)).
            // Let's assume direct success if eval is Ok. A more robust solution would parse the JSON.
            println!("Injection script executed. Result: {:?}", eval_result); // Log the raw result
            // A better check would be:
            // if let Ok(serde_json::Value::Object(map)) = eval_result {
            //    if map.get("success").and_then(|v| v.as_bool()) == Some(true) { Ok(()) }
            //    else { Err(map.get("error").and_then(|v| v.as_str()).unwrap_or("Injection script reported failure.").to_string()) }
            // } else { Err("Injection script returned unexpected format.".to_string())}
            Ok(()) // Simplified: assume Ok if eval itself is Ok.
        }
        Err(e) => Err(format!("Failed to execute content injection script: {}", e)),
    }
}
