import { initialsFor } from './member-display';
import './member-avatar.css';

export function MemberAvatar({
  name,
  profileImagePath,
  className = '',
}: {
  name: string;
  profileImagePath?: string | null;
  className?: string;
}) {
  return (
    <span className={`member-avatar ${className}`.trim()} aria-hidden="true">
      <span className="member-avatar-initials">{initialsFor(name)}</span>
      {profileImagePath && (
        <img
          src={profileImagePath}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </span>
  );
}
