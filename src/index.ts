/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { parse } from 'csv-parse/sync';

interface Birthday {
  name: string;
  date: string;
}
 
async function handleUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const csvFile = formData.get('csv') as File;

  if (!csvFile) {
    return new Response('No CSV file uploaded', { status: 400 });
  }

  const csvContent = await csvFile.text();
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  const birthdays: Birthday[] = records.map((record: any) => ({
    name: record.name,
    date: record.date,
  }));

  // Store birthdays in D1
  for (const birthday of birthdays) {
    await env.DB.prepare(`
      INSERT INTO birthdays (name, date)
      VALUES (?, ?, ?)
    `).bind(birthday.name, birthday.date).run();
	}

	return new Response('Birthdays uploaded successfully');
	}

async function handleCheckReminders(env: Env): Promise<Response> {
  const today = new Date();
  const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { results } = await env.DB.prepare(`
    SELECT name, date
    FROM birthdays
    WHERE strftime('%m-%d', date) = strftime('%m-%d', ?)
  `).bind(twoWeeksLater.toISOString().split('T')[0]).all();

  const typedResults = results.map(r => ({
    name: r.name as string,
    date: r.date as string,
  }));

  if (typedResults.length === 0) {
    return new Response('No reminders to send today');
  }

  await sendReminders(typedResults, env);
  return new Response(`Sent ${typedResults.length} reminders`);
}

async function sendReminders(reminders: Birthday[], env: Env): Promise<void> {
  for (const reminder of reminders) {
    const birthdayDate = new Date(reminder.date);
    const formattedDate = birthdayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const message = `Reminder: ${reminder.name}'s birthday is in 2 weeks on ${formattedDate}`;

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

    const encoded = new URLSearchParams({
      To: env.YOUR_PHONE_NUMBER,
      From: env.TWILIO_PHONE_NUMBER,
      Body: message,
    });

    const token = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

    const request = {
      body: encoded,
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const response = await fetch(endpoint, request);
    const result = await response.json();

    // You might want to log the result or handle errors here
    console.log(result);
  }
}


export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	  const url = new URL(request.url);
	  
	  if (url.pathname === '/upload' && request.method === 'POST') {
		return handleUpload(request, env);
	  } else if (url.pathname === '/check-reminders' && request.method === 'GET') {
		return handleCheckReminders(env);
	  }
  
	  return new Response('Birthday Reminder App');
	},

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleCheckReminders(env);
  },
} satisfies ExportedHandler<Env>;