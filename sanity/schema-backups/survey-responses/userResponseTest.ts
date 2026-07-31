// Historical schema retained for the PostgreSQL migration archive.
export default {
    name: 'userResponseTest',
    type: 'document',
    title: 'User Response Test',
    fields: [
      {
        name: 'question1',
        type: 'string',
        title: 'Answer to Question 1',
      },
      {
        name: 'question2',
        type: 'string',
        title: 'Answer to Question 2',
      },
      {
        name: 'question3',
        type: 'string',
        title: 'Answer to Question 3',
      },
      {
        name: 'question4',
        type: 'string',
        title: 'Answer to Question 4',
      },
      {
        name: 'question5',
        type: 'string',
        title: 'Answer to Question 5',
      },
      {
        name: 'submittedAt',
        type: 'datetime',
        title: 'Submitted At',
      },
    ],
  };
  
