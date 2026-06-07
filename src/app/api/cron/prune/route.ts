import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("Cron Prune Unauthorized: Invalid CRON_SECRET");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("Starting automated 6-month database pruning...");
    
    // Calculate date exactly 6 months ago from now
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Delete messages older than 6 months
    const { error, count } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .lt('created_at', sixMonthsAgo.toISOString());

    if (error) {
      throw error;
    }

    console.log(`Cron Prune Success: Deleted ${count || 0} old messages.`);
    return NextResponse.json({ 
      success: true, 
      message: 'Pruned old messages successfully',
      deleted_count: count || 0
    });
    
  } catch (error) {
    console.error('Cron Prune Error:', error);
    return NextResponse.json({ error: 'Failed to prune messages' }, { status: 500 });
  }
}
