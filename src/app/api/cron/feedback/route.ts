import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWhatsAppPoll } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("Cron Feedback Unauthorized: Invalid CRON_SECRET");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("Starting automated feedback poll sender...");
    
    // Find tickets that are resolved but haven't had feedback requested
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('status', 'resolved')
      .is('feedback_sent', false)
      .limit(10); // Process 10 at a time to avoid rate limits

    if (error) throw error;
    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending feedback polls.' });
    }

    console.log(`Found ${tickets.length} tickets needing feedback polls.`);
    
    let sentCount = 0;
    for (const ticket of tickets) {
      const question = `🎉 Good news! Your ticket has been resolved.\n\n*Ticket ID:* ${ticket.id.split('-')[0]}\n*Issue:* ${ticket.description}\n\nHow satisfied are you with the maintenance team's work? Please rate from 1 to 5 stars:`;
      
      const options = [
        { id: `feedback_${ticket.id}_5`, title: "⭐⭐⭐⭐⭐ Excellent" },
        { id: `feedback_${ticket.id}_4`, title: "⭐⭐⭐⭐ Good" },
        { id: `feedback_${ticket.id}_3`, title: "⭐⭐⭐ Average" }
      ]; // WhatsApp allows max 3 buttons per message natively, or we can send 1-5 as a list. But standard interactive buttons allow 3.
      
      // Since WhatsApp max buttons is 3, we'll send a text message asking them to reply, or use a list message.
      // We already have `sendWhatsAppPoll` which sends a proper poll message, so we can use that for 1-5 options!
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
        sentCount++;
      } catch (e) {
        console.error(`Failed to send poll for ticket ${ticket.id}:`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Feedback polls processed',
      sent_count: sentCount
    });
    
  } catch (error) {
    console.error('Cron Feedback Error:', error);
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 });
  }
}
