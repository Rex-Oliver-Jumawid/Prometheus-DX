-- Project Chat mentions reuse the existing authenticated Notifications inbox.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_CHAT_MENTION';
