import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { formatClock } from '../schedule/schedule-format';
import { formatHours } from '../work-sessions/work-session-format';
import { teamWorkSummaryQuery } from '../work-sessions/work-session-queries';
import './team.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function TeamPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const team = useQuery(teamWorkSummaryQuery(session?.access_token));

  if (team.isPending) {
    return <section className="team-state">Loading Team...</section>;
  }
  if (team.isError) {
    return (
      <section className="team-state error" role="alert">
        <h1>Team could not be loaded</h1>
        <p>{team.error.message}</p>
        <button onClick={() => void team.refetch()}>Try again</button>
      </section>
    );
  }

  const data = team.data;
  return (
    <section className="team-page" aria-labelledby="team-title">
      <header className="team-header">
        <div>
          <p className="page-kicker">PEOPLE</p>
          <h1 id="team-title">Team</h1>
          <p>
            Registry identity, planned availability, and actual weekly work at a
            glance.
          </p>
        </div>
        <span className="team-timezone">UTC+08:00 · Asia/Manila</span>
      </header>

      <div className="team-summary" aria-label="Team summary">
        <article>
          <span>Team members</span>
          <strong>{data.summary.memberCount}</strong>
        </article>
        <article>
          <span>Working now</span>
          <strong>{data.summary.workingNowCount}</strong>
        </article>
        <article>
          <span>Week total</span>
          <strong>
            {formatHours(data.summary.actualWorkedSeconds)} /{' '}
            {formatHours(data.summary.scheduledMinutes * 60)}
          </strong>
          <small>Actual / scheduled</small>
        </article>
      </div>

      {data.members.length === 0 ? (
        <div className="team-empty">No active Registry members.</div>
      ) : (
        <div className="team-grid">
          {data.members.map((member) => (
            <article className="team-card" key={member.id}>
              <div className="team-card-head">
                <div className="team-person">
                  <span className="team-avatar" aria-hidden="true">
                    {initials(member.fullName)}
                  </span>
                  <div>
                    <strong>{member.fullName}</strong>
                    <span>{member.position || 'Position not set'}</span>
                    <small>{member.department.name}</small>
                  </div>
                </div>
                <span
                  className={`team-status${member.workingNow ? ' working' : ''}`}
                >
                  {member.workingNow ? 'Working Now' : 'Timed Out'}
                </span>
              </div>

              <div className="team-plan">
                <span>Today's plan</span>
                <strong>
                  {member.todaySchedule.length
                    ? member.todaySchedule
                        .map(
                          (block) =>
                            `${formatClock(block.startTime)} - ${formatClock(block.endTime)}`,
                        )
                        .join(', ')
                    : 'Rest day / no schedule'}
                </strong>
              </div>

              <div className="team-metrics">
                <div>
                  <span>Scheduled week</span>
                  <strong>{formatHours(member.scheduledMinutes * 60)}</strong>
                </div>
                <div>
                  <span>Worked week</span>
                  <strong>{formatHours(member.actualWorkedSeconds)}</strong>
                </div>
              </div>

              <button onClick={() => navigate('/schedule')}>
                View Schedule
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
