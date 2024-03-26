This is a basic Google Apps Script (i.e. Javascript) used to create a data connector for use in Looker Studio. Alma (a Library Management System by Clarivate) has an API that can be leveraged for reporting purposes... if you're willing to parse the JSON.

This script parses some of the information from the Course API endpoint, primarily to display basic course information such as code, name, department, if it has a reading list, and how many citations (books, articles, etc.) are on the reading list if the course is associated with one.

This connector can be used by any institution that has access to Alma's API, as it requires you to provide your institution's API key for connection.
