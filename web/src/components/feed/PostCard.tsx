import { memo, useState } from 'react';
import { Link } from 'react-router';
import { shareLink, copyToClipboard } from '@/lib/actions';
import { api, errorMessage } from '@/lib/api';
import { postLink } from '@/lib/config';
import { feedback } from '@/lib/feedback';
import { timeAgo } from '@/lib/format';
import { goBack, navigate } from '@/lib/nav';
import { removePostEverywhere, updatePostEverywhere } from '@/lib/queries';
import type { Post } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors } from '@/theme';
import {
  IconCopy,
  IconEllipsis,
  IconFlag,
  IconGlobe,
  IconMessageSquare,
  IconShare,
  IconShieldCheck,
  IconTrash,
  IconUsers,
} from '../icons';
import { ActionSheet, Avatar, Card, confirm, IconButton, InlineNotice, type SheetAction } from '../ui';
import { LikeButton } from './LikeButton';
import { LinkCard, PaperAttachment } from './PostAttachments';
import styles from './PostCard.module.css';
import { PostMedia } from './PostMedia';

interface Props {
  post: Post;
  signedIn: boolean;
  /** Full text and no "open post" link (post detail page). */
  detail?: boolean;
  onCommentClick?: () => void;
}

async function toggleLike(post: Post) {
  const like = !post.liked;
  updatePostEverywhere(post.id, (p) => ({ ...p, liked: like, likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)) }));
  try {
    const result = await api<{ liked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`, {
      method: 'POST',
      body: { like },
    });
    updatePostEverywhere(post.id, (p) => ({ ...p, liked: result.liked, likeCount: result.likeCount }));
  } catch (error) {
    updatePostEverywhere(post.id, (p) => ({ ...p, liked: post.liked, likeCount: post.likeCount }));
    toast.error('Could not update like', errorMessage(error));
  }
}

function PostCardBase({ post, signedIn, detail, onCommentClick }: Props) {
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(!!detail);
  const long = post.text.length > 320;
  const authorHref = `/u/${post.author.username}`;

  const actions: SheetAction[] = [
    { label: 'Copy link to post', icon: IconCopy, onClick: () => copyToClipboard(postLink(post.id), 'Post link copied') },
  ];
  if (signedIn && !post.isOwner) {
    actions.push({
      label: 'Report post',
      description: 'Not academic, spam or inappropriate',
      icon: IconFlag,
      destructive: true,
      onClick: async () => {
        const ok = await confirm({
          title: 'Report this post?',
          message: 'Moderators review posts that several researchers report. The author is not told who reported it.',
          confirmLabel: 'Report',
          destructive: true,
        });
        if (!ok) return;
        try {
          await api(`/api/posts/${post.id}/report`, { method: 'POST', body: { reason: 'Not academic content' } });
          feedback.success();
          toast.success('Thanks for reporting', 'Our moderators will review this post.');
        } catch (error) {
          toast.error('Report failed', errorMessage(error));
        }
      },
    });
  }
  if (post.isOwner) {
    actions.push({
      label: 'Delete post',
      icon: IconTrash,
      destructive: true,
      onClick: async () => {
        const ok = await confirm({
          title: 'Delete this post?',
          message: 'This cannot be undone.',
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!ok) return;
        try {
          await api(`/api/posts/${post.id}`, { method: 'DELETE' });
          removePostEverywhere(post.id);
          feedback.success();
          toast.success('Post deleted');
          if (detail) goBack('/');
        } catch (error) {
          toast.error('Delete failed', errorMessage(error));
        }
      },
    });
  }

  const AudienceIcon = post.audience === 'public' ? IconGlobe : IconUsers;
  const text = (
    <p className={`t-body pre-wrap ${!expanded && long ? 'clamp-6' : ''}`} style={{ color: colors.ink }}>
      {post.text}
    </p>
  );

  return (
    <Card padded={false} as="article" className={styles.card}>
      <header className={styles.header}>
        <Link to={authorHref} aria-label={`${post.author.name}'s profile`} className={styles.avatarLink}>
          <Avatar name={post.author.name} url={post.author.avatarUrl} size={44} online={post.author.online} />
        </Link>
        <Link to={authorHref} className={styles.who}>
          <span className={`${styles.name} nowrap`}>{post.author.name}</span>
          {post.author.headline ? <span className="t-caption nowrap">{post.author.headline}</span> : null}
          <span className={styles.metaRow}>
            <time className="t-caption" dateTime={post.createdAt}>
              {timeAgo(post.createdAt)}
            </time>
            <AudienceIcon size={12} color={colors.text3} aria-label={post.audience === 'public' ? 'Public' : 'Connections'} />
          </span>
        </Link>
        <IconButton icon={IconEllipsis} label="Post options" onClick={() => setMenu(true)} color={colors.text2} size={36} />
      </header>

      <div className={styles.tags}>
        <span className={styles.category}>{post.category}</span>
        <span className={styles.check} title="Passed the academic content check">
          <IconShieldCheck size={13} color={colors.success} aria-hidden />
          Academic
        </span>
      </div>

      {post.moderation.status !== 'approved' && post.isOwner ? (
        <InlineNotice tone="warning" title="Under review" style={{ margin: '0 16px 10px' }}>
          Several researchers reported this post, so it is hidden from others until a moderator reviews it.
        </InlineNotice>
      ) : null}

      {post.text ? (
        <div className={styles.body}>
          {detail ? (
            text
          ) : (
            <Link to={`/post/${post.id}`} className={styles.textLink}>
              {text}
            </Link>
          )}
          {long && !expanded ? (
            <button
              type="button"
              className={styles.more}
              onClick={() => {
                feedback.tap();
                setExpanded(true);
              }}
            >
              Show more
            </button>
          ) : null}
        </div>
      ) : null}

      {post.kind === 'link' && post.link ? (
        <div className={styles.attachment}>
          <LinkCard url={post.link.url} domain={post.link.domain} />
        </div>
      ) : null}
      {post.kind === 'paper' && post.paper ? (
        <div className={styles.attachment}>
          <PaperAttachment paper={post.paper} signedIn={signedIn} />
        </div>
      ) : null}
      {post.kind === 'media' ? (
        <div className={styles.attachment}>
          <PostMedia media={post.media} />
        </div>
      ) : null}

      <footer className={styles.footer}>
        <LikeButton liked={post.liked} count={post.likeCount} onToggle={() => (signedIn ? toggleLike(post) : navigate('/login'))} />
        <button
          type="button"
          className={styles.footerButton}
          aria-label={`Comments, ${post.commentCount}`}
          onClick={() => {
            feedback.tap();
            if (onCommentClick) onCommentClick();
            else navigate(`/post/${post.id}`);
          }}
        >
          <IconMessageSquare size={19} color={colors.text2} strokeWidth={1.8} aria-hidden />
          <span>{post.commentCount > 0 ? post.commentCount : 'Comment'}</span>
        </button>
        <span className="grow" />
        <button
          type="button"
          className={styles.footerButton}
          aria-label="Share post"
          onClick={() => {
            feedback.tap();
            shareLink(postLink(post.id), `${post.author.name} on LetResearch`, 'Post link copied');
          }}
        >
          <IconShare size={18} color={colors.text2} strokeWidth={1.8} aria-hidden />
          <span>Share</span>
        </button>
      </footer>
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={actions} />
    </Card>
  );
}

export const PostCard = memo(PostCardBase);
