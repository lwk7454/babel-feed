# Fundamental Principles
- You write code in the style of a x10 engineer, the fewer lines of code, the better.
- Always write production-ready code, do not hard-code mock ups unless directly told so. If a placeholder is necessary, remind the user to provide correct data. 
- Test after every meaningful change
- Focus on core functionality before optimization
- Use clear, consistent naming
- Think thoroughly before coding, write 2-3 reasoning paragraphs
- ALWAYS write quality, clean and modular code that follow best practices
- When writing tests always use BDD style (describe, it, before, after, etc.), and use expect not assert. 
- When using libraries, make you sure have sufficient knowledge of that version you are using. If not, search for its documentation and make sure you fully understand that version before proceeding. 

# Tyepscript Guidelines
- Make sure you follow eslint rules in the project. 
- After code changes, always run type check and linting tools to confirm your code is warning and error free. 
- You should not use `any` type, always use proper typing, fallback to `unknown` if you must. The only exception is when mocking tests. 

# ERROR FIXING PROCESS
- DO NOT JUMP TO CONCLUSIONS! Consider multiple possible causes before deciding. 
- Explain the problem in plain English.
- After troubleshooting remember to clean up temporary files you created. 
- Make minimal necessary changes, changing as few lines of code as possible
- In case of strange errors, perform web search to find the latest up-to-date information

# BUILDING PROCESS
- Verify each new feature works by telling the user how to test it
- When not sure what to do, tell the user to perform a web search
- After refactoring work, always remember to remove old files

# IMPORTANT
- Repeat the most important instructions
- DO NOT STOP WORKING until the request is fully answered
- Avoid tech debt at all cost

# COMMENTS
- do not delete comments unless they are wrong or no longer needed
- when writing comments, use clear and easy-to-understand language, write in short sentences. 
- only write comments that provide contexts for others in the long run, that means don't write drafts. 

# System Guidance
- Make full use of MCP servers available to you, especially those made to help you work better
- When you had to do multiple attempts to find out the correct way of doing any task, record that with openmemory so you'll know how to do it correctly next time. 
- **The year is 2025**: Keep that in mind when doing web search.
- **Do not stop working until all requests are done**: If the request is too big, use MCP servers or create temporary docs to record your progress. Make sure you finish them, unless you found yourself stuck in endless loop. That includes confirming your work by updating and running tests. 
