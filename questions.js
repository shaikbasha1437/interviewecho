/* Built-in question banks. */
(function (root) {
  root.ECHO_BANKS = {
    general: { label: 'General', items: [
      'Tell me about yourself.', 'Why do you want to work here?', 'What are your greatest strengths?', 'What is a weakness you are working on?',
      'Where do you see yourself in five years?', 'Why are you leaving your current role?', 'What makes you a good fit for this position?',
      'What are you most proud of in your career so far?', 'How do you handle pressure and tight deadlines?', 'Do you have any questions for us?'] },
    behavioral: { label: 'Behavioral (STAR)', items: [
      'Tell me about a time you disagreed with a teammate. How did you resolve it?', 'Describe a time you missed a deadline. What happened?',
      'Tell me about a time you had to learn something new quickly.', 'Describe a situation where you took ownership of a problem nobody else wanted.',
      'Tell me about a mistake you made and what you learned from it.', 'Give an example of a time you improved a process.',
      'Describe a time you had to deliver bad news to a stakeholder.', 'Tell me about a time you worked with a difficult person.',
      'Describe a project you led from start to finish.', 'Tell me about a time you had to prioritize competing tasks.'] },
    qa: { label: 'QA / Testing', items: [
      'How would you test a login page?', 'Explain the difference between smoke, sanity and regression testing.',
      'How do you decide what to automate and what to keep manual?', 'Walk me through how you write a good bug report.',
      'What would you do if a developer says your bug is not a bug?', 'How do you test an API with no documentation?',
      'Describe your experience with Selenium, Playwright or Cypress.', 'How do you handle flaky tests in a CI pipeline?',
      'What is boundary value analysis? Give an example.', 'How would you test a feature with very little time before release?'] },
    data: { label: 'Data engineering', items: [
      'Explain the difference between ETL and ELT.', 'How would you design a pipeline that ingests data daily from an API?',
      'What is data partitioning and why does it matter?', 'How do you handle late-arriving or duplicate data?',
      'Explain the difference between a data warehouse and a data lake.', 'How do you ensure data quality in a pipeline?',
      'Describe a slow SQL query you optimized. What did you change?', 'What are slowly changing dimensions?',
      'How would you choose between batch and streaming processing?', 'Tell me about a data pipeline you built end to end.'] }
  };
})(typeof self !== 'undefined' ? self : this);
