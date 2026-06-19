import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(getMockAnalytics());
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [applicationsRes, atsScoresRes, notificationsRes] = await Promise.all([
      supabase
        .from('applications')
        .select('id, status, applied_at, created_at')
        .eq('user_id', userId),
      supabase
        .from('ats_scores')
        .select('score, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(30),
      supabase
        .from('notifications')
        .select('id, is_read, created_at')
        .eq('user_id', userId)
        .eq('is_read', false),
    ]);

    const applications = applicationsRes.data || [];
    const atsScores = atsScoresRes.data || [];
    const unreadNotifications = notificationsRes.data || [];

    const statusCounts = applications.reduce(
      (acc: Record<string, number>, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      },
      {}
    );

    const total = applications.length;
    const applied = statusCounts.applied || 0;
    const interviewing = statusCounts.interviewing || 0;
    const offered = statusCounts.offered || 0;
    const rejected = statusCounts.rejected || 0;

    const responseRate = total > 0 ? Math.round(((interviewing + offered) / total) * 100) : 0;
    const interviewRate = applied > 0 ? Math.round((interviewing / (applied || 1)) * 100) : 0;
    const offerRate = total > 0 ? Math.round((offered / total) * 100) : 0;

    const avgAtsScore =
      atsScores.length > 0
        ? Math.round(atsScores.reduce((s, r) => s + r.score, 0) / atsScores.length)
        : 0;

    // Weekly applications trend (last 8 weeks)
    const weeklyTrend = buildWeeklyTrend(applications);

    return NextResponse.json({
      summary: {
        totalApplications: total,
        applied,
        interviewing,
        offered,
        rejected,
        pending: statusCounts.pending || 0,
        responseRate,
        interviewRate,
        offerRate,
        avgAtsScore,
        unreadNotifications: unreadNotifications.length,
      },
      weeklyTrend,
      atsScoreTrend: atsScores.map((s) => ({
        date: s.created_at,
        score: s.score,
      })),
      statusBreakdown: [
        { label: 'Applied', value: applied, color: '#2563eb' },
        { label: 'Interviewing', value: interviewing, color: '#10b981' },
        { label: 'Offered', value: offered, color: '#7c3aed' },
        { label: 'Rejected', value: rejected, color: '#ef4444' },
        { label: 'Pending', value: statusCounts.pending || 0, color: '#f59e0b' },
      ],
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildWeeklyTrend(applications: any[]) {
  const weeks: Record<string, number> = {};
  const now = new Date();

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    const label = `W${8 - i}`;
    weeks[label] = 0;
  }

  applications.forEach((app) => {
    const appDate = new Date(app.applied_at || app.created_at);
    const weeksAgo = Math.floor((now.getTime() - appDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksAgo <= 7) {
      const label = `W${8 - weeksAgo}`;
      weeks[label] = (weeks[label] || 0) + 1;
    }
  });

  return Object.entries(weeks).map(([week, count]) => ({ week, count }));
}

function getMockAnalytics() {
  return {
    summary: {
      totalApplications: 28,
      applied: 12,
      interviewing: 5,
      offered: 2,
      rejected: 7,
      pending: 2,
      responseRate: 25,
      interviewRate: 42,
      offerRate: 7,
      avgAtsScore: 74,
      unreadNotifications: 3,
    },
    weeklyTrend: [
      { week: 'W1', count: 2 },
      { week: 'W2', count: 3 },
      { week: 'W3', count: 5 },
      { week: 'W4', count: 4 },
      { week: 'W5', count: 6 },
      { week: 'W6', count: 3 },
      { week: 'W7', count: 4 },
      { week: 'W8', count: 1 },
    ],
    atsScoreTrend: [
      { date: new Date(Date.now() - 7 * 86400000).toISOString(), score: 62 },
      { date: new Date(Date.now() - 5 * 86400000).toISOString(), score: 68 },
      { date: new Date(Date.now() - 3 * 86400000).toISOString(), score: 74 },
      { date: new Date(Date.now() - 1 * 86400000).toISOString(), score: 79 },
    ],
    statusBreakdown: [
      { label: 'Applied', value: 12, color: '#2563eb' },
      { label: 'Interviewing', value: 5, color: '#10b981' },
      { label: 'Offered', value: 2, color: '#7c3aed' },
      { label: 'Rejected', value: 7, color: '#ef4444' },
      { label: 'Pending', value: 2, color: '#f59e0b' },
    ],
    mock: true,
  };
}
