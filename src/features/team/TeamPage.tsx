import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

function TeamAvatar({
  fullName,
  profileImagePath,
}: {
  fullName: string;
  profileImagePath: string | null;
}) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null);
  const imageSrc =
    profileImagePath && failedImagePath !== profileImagePath
      ? profileImagePath
      : null;

  return (
    <span
      className={`team-avatar${imageSrc ? ' has-image' : ''}`}
      role="img"
      aria-label={`${fullName} profile picture`}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedImagePath(imageSrc)}
        />
      ) : (
        initials(fullName)
      )}
    </span>
  );
}

function memberSubtitle(
  position: string | null | undefined,
  departmentName: string,
): string {
  return [position?.trim(), departmentName.trim()].filter(Boolean).join(' / ');
}

function TeamHeader() {
  return (
    <header className="team-header">
      <p className="page-kicker">PEOPLE</p>
      <h1 id="team-title">Team</h1>
      <p>
        People, availability, current work status, and weekly commitment at a
        glance.
      </p>
    </header>
  );
}

function TeamLoadingState() {
  return (
    <section
      className="team-page team-page-loading"
      aria-labelledby="team-title"
      aria-busy="true"
    >
      <TeamHeader />
      <div className="team-summary" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <article key={index}>
            <span className="team-skeleton team-skeleton-label" />
            <span className="team-skeleton team-skeleton-value" />
          </article>
        ))}
      </div>
      <div className="team-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <article className="team-card team-card-skeleton" key={index}>
            <div className="team-card-head">
              <div className="team-person">
                <span className="team-skeleton team-skeleton-avatar" />
                <div>
                  <span className="team-skeleton team-skeleton-name" />
                  <span className="team-skeleton team-skeleton-copy" />
                </div>
              </div>
              <span className="team-skeleton team-skeleton-status" />
            </div>
            <div className="team-plan">
              <span className="team-skeleton team-skeleton-label" />
              <span className="team-skeleton team-skeleton-plan" />
            </div>
            <div className="team-metrics">
              <div>
                <span className="team-skeleton team-skeleton-label" />
                <span className="team-skeleton team-skeleton-metric" />
              </div>
              <div>
                <span className="team-skeleton team-skeleton-label" />
                <span className="team-skeleton team-skeleton-metric" />
              </div>
            </div>
            <span className="team-skeleton team-skeleton-button" />
          </article>
        ))}
      </div>
      <span className="team-loading-copy" role="status">
        Loading Team...
      </span>
    </section>
  );
}

export function TeamPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const team = useQuery(teamWorkSummaryQuery(session?.access_token));

  if (team.isPending) {
    return <TeamLoadingState />;
  }

  if (team.isError) {
    return (
      <section className="team-page" aria-labelledby="team-title">
        <TeamHeader />
        <div className="team-state error" role="alert">
          <strong>Team could not be loaded</strong>
          <p>
            {team.error instanceof Error
              ? team.error.message
              : 'Current Team data is unavailable.'}
          </p>
          <button type="button" onClick={() => void team.refetch()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const data = team.data;

  return (
    <section className="team-page" aria-labelledby="team-title">
      <TeamHeader />

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
        </article>
      </div>

      {data.members.length === 0 ? (
        <div className="team-empty">
          <strong>No active Registry members.</strong>
          <p>
            Active members will appear here with their schedule and recorded
            work totals.
          </p>
        </div>
      ) : (
        <div className="team-grid">
          {data.members.map((member) => (
            <article className="team-card" key={member.id}>
              <div className="team-card-head">
                <div className="team-person">
                  <TeamAvatar
                    fullName={member.fullName}
                    profileImagePath={member.profileImagePath}
                  />
                  <div>
                    <strong title={member.fullName}>{member.fullName}</strong>
                    <span
                      className="team-person-subtitle"
                      title={memberSubtitle(
                        member.position,
                        member.department.name,
                      )}
                    >
                      {memberSubtitle(member.position, member.department.name)}
                    </span>
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
                            `${formatClock(block.startTime)}–${formatClock(block.endTime)}`,
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

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/schedule?view=shifts&member=${encodeURIComponent(member.id)}`,
                  )
                }
              >
                <span>View Schedule</span>
                <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
