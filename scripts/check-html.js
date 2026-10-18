async function checkHtml() {
  const loginHtml = await fetch('http://localhost:3000/login.html').then(r => r.text());
  console.log('Login has Citizen Account:', loginHtml.includes('Citizen Account'));
  console.log('Login has Municipal Admin:', loginHtml.includes('Municipal Admin'));
  console.log('Login has Maintenance Unit:', loginHtml.includes('Maintenance Unit'));
  console.log('Login has team@draincare.org:', loginHtml.includes('team@draincare.org'));

  const reportHtml = await fetch('http://localhost:3000/report-problem.html').then(r => r.text());
  console.log('Report form has file input:', /type=["']file["']/i.test(reportHtml));
  console.log('Report form has Choose File:', /choose file/i.test(reportHtml));
  console.log('Report form has Gallery picker:', /choose from gallery|upload from gallery|select an existing photo/i.test(reportHtml));
  console.log('Report form has TAKE PHOTO button:', reportHtml.includes('TAKE PHOTO'));
  console.log('Report form has DETECT MY CURRENT LOCATION:', reportHtml.includes('DETECT MY CURRENT LOCATION'));
}

checkHtml().catch(console.error);
