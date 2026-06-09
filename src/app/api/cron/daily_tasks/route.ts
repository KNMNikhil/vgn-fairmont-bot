import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppPoll, sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("Cron Unauthorized: Invalid CRON_SECRET");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("Starting unified daily cron tasks...");
    
    // TASK 1: Send Feedback Polls for Resolved Tickets
    let feedbackSentCount = 0;
    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'resolved')
        .is('feedback_sent', false)
        .limit(10); // Process 10 at a time to avoid rate limits

      if (ticketsError) throw ticketsError;

      if (tickets && tickets.length > 0) {
        console.log(`Found ${tickets.length} tickets needing feedback polls.`);
        for (const ticket of tickets) {
          const question = `🎉 Good news! Your ticket has been resolved.\n\n*Ticket ID:* ${ticket.id.split('-')[0]}\n*Issue:* ${ticket.description}\n\nHow satisfied are you with the maintenance team's work? Please rate from 1 to 5 stars:`;
          
          const pollOptions = [
            "⭐⭐⭐⭐⭐ Excellent (5)",
            "⭐⭐⭐⭐ Good (4)",
            "⭐⭐⭐ Average (3)",
            "⭐⭐ Poor (2)",
            "⭐ Terrible (1)"
          ];

          try {
            await sendWhatsAppPoll(ticket.phone, question, pollOptions.map((title, i) => ({ id: `feedback_${ticket.id}_${5-i}`, title })));
            // Mark as sent
            await supabase.from('tickets').update({ feedback_sent: true }).eq('id', ticket.id);
            feedbackSentCount++;
          } catch (e) {
            console.error(`Failed to send poll for ticket ${ticket.id}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("Error processing feedback polls:", e);
    }

    // TASK 2: Maintenance Fee Reminders (Runs only on the 1st of the month)
    let remindersSentCount = 0;
    const today = new Date();
    // Assuming IST timezone (UTC+5:30)
    const currentDay = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDate();

    if (currentDay === 1) {
      console.log("Today is the 1st of the month. Running Maintenance Fee Reminders...");
      try {
        const { data: dues, error: duesError } = await supabase
          .from('maintenance_dues')
          .select('*')
          .eq('status', 'unpaid')
          .limit(50); // Batch limit

        if (duesError) throw duesError;

        if (dues && dues.length > 0) {
          console.log(`Found ${dues.length} pending dues. Sending reminders...`);
          for (const due of dues) {
            // Note: Since this is outside the 24-hour window, WhatsApp requires a pre-approved Utility Template.
            // For now, we use a generic sendWhatsAppMessage, but you MUST implement a template sending function 
            // once your Utility template is approved in Meta Business Manager.
            const reminderMessage = `🔔 *Maintenance Reminder*\n\nDear Resident (Flat ${due.flat_number}),\nYour maintenance fee of ₹${due.amount_due} is due.\n\nPlease clear the pending amount at your earliest convenience to avoid late fees. Thank you!`;
            
            try {
              await sendWhatsAppMessage(due.phone_number, reminderMessage);
              remindersSentCount++;
            } catch (e) {
              console.error(`Failed to send reminder to ${due.phone_number}:`, e);
            }
          }
        }
      } catch (e) {
        console.error("Error processing maintenance reminders:", e);
      }
    } else {
      console.log(`Today is day ${currentDay} of the month. Skipping maintenance reminders.`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Daily tasks processed',
      feedback_sent_count: feedbackSentCount,
      reminders_sent_count: remindersSentCount
    });
    
  } catch (error) {
    console.error('Cron Tasks Error:', error);
    return NextResponse.json({ error: 'Failed to process daily tasks' }, { status: 500 });
  }
}
