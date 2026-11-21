const $ = selector => document.querySelector(selector);

export function initMersalPosts({ supabase, getCurrentUser, announce, safeText }) {
  const panel = $("#posts-panel");
  const closeButton = $("#posts-close");
  const title = $("#posts-title");
  const refreshButton = $("#posts-refresh");
  const form = $("#public-post-form");
  const bodyInput = $("#public-post-body");
  const mediaInput = $("#public-post-media");
  const mediaName = $("#public-post-media-name");
  const submitButton = $("#public-post-submit");
  const list = $("#public-posts-list");
  const status = $("#posts-status");
  let realtime = null;
  let loadSequence = 0;
  let busy = false;
  let returnFocus = null;
  let posts = [];
  const english = () => document.documentElement.lang === "en";
  const t = (ar, en) => english() ? en : ar;
  const dateFormat = () => new Intl.DateTimeFormat(english() ? "en" : "ar-JO", { dateStyle: "medium", timeStyle: "short" });

  function setStatus(ar, en, error = false) {
    if (!status) return;
    status.textContent = t(ar, en);
    status.dataset.kind = error ? "error" : "info";
  }

  function localize() {
    if (!panel) return;
    closeButton.textContent = t("إغلاق المنشورات", "Close posts");
    closeButton.setAttribute("aria-label", closeButton.textContent);
    title.textContent = t("المنشورات العامة", "Public posts");
    refreshButton.textContent = t("تحديث المنشورات", "Refresh posts");
    refreshButton.setAttribute("aria-label", refreshButton.textContent);
    const label = form.querySelector("label[for='public-post-body']");
    if (label) label.textContent = t("اكتب منشورًا للجميع", "Write a post for everyone");
    bodyInput.placeholder = t("بماذا تفكر؟", "What's on your mind?");
    const mediaLabel = form.querySelector("label[for='public-post-media']");
    if (mediaLabel) mediaLabel.textContent = t("إرفاق صورة أو فيديو (اختياري)", "Attach a photo or video (optional)");
    submitButton.textContent = t("نشر المنشور", "Publish post");
    if (!mediaInput.files?.length) mediaName.textContent = "";
    list.setAttribute("aria-label", t("المنشورات العامة الأحدث أولًا", "Public posts, newest first"));
  }

  const languageObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "lang")) {
      localize();
      if (!panel.hidden) renderFeed();
    }
  });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  async function stopRealtime() {
    if (!realtime) return;
    const channel = realtime;
    realtime = null;
    await supabase.removeChannel(channel);
  }

  async function startRealtime() {
    await stopRealtime();
    if (panel.hidden || !getCurrentUser()) return;
    realtime = supabase.channel("mersal-public-posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "public_posts" }, () => { void loadFeed(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "public_post_likes" }, () => { void loadFeed(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "public_post_comments" }, () => { void loadFeed(false); })
      .subscribe();
  }

  async function visibleProfiles(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return new Map();
    const result = await supabase.rpc("get_visible_profiles", { p_user_ids: unique });
    if (result.error) throw result.error;
    const profiles = result.data || [];
    await Promise.all(profiles.map(async profile => {
      if (!profile.avatar_url || /^https?:\/\//i.test(profile.avatar_url)) return;
      const signed = await supabase.storage.from("mersal-profile-photos").createSignedUrl(profile.avatar_url, 3600);
      profile.avatar_url = signed.error ? null : signed.data?.signedUrl || null;
    }));
    return new Map(profiles.map(profile => [profile.id, profile]));
  }

  async function signedMedia(paths) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return new Map();
    const result = await supabase.storage.from("mersal-attachments").createSignedUrls(unique, 3600);
    if (result.error) {
      console.warn("Could not sign public post media:", result.error.message);
      return new Map();
    }
    return new Map((result.data || []).map(item => [item.path, item.signedUrl]));
  }

  async function loadFeed(showLoading = true) {
    const user = getCurrentUser();
    if (!user || panel.hidden) return;
    const request = ++loadSequence;
    if (showLoading) setStatus("جارٍ تحميل المنشورات…", "Loading posts…");
    const result = await supabase.from("public_posts")
      .select("id,author_id,body,media_path,media_type,created_at,edited_at")
      .order("created_at", { ascending: false }).limit(100);
    if (request !== loadSequence || panel.hidden || getCurrentUser()?.id !== user.id) return;
    if (result.error) {
      setStatus("تعذر تحميل المنشورات. حاول التحديث مرة أخرى.", "Could not load posts. Please refresh.", true);
      list.replaceChildren(safeText("li", "empty-item", t("تعذر تحميل المنشورات.", "Could not load posts.")));
      return;
    }
    posts = result.data || [];
    if (!posts.length) {
      list.replaceChildren(safeText("li", "empty-item", t("لا توجد منشورات حتى الآن. كن أول من ينشر!", "No posts yet. Be the first to share!")));
      setStatus("", "");
      return;
    }
    const ids = posts.map(post => post.id);
    const authorIds = posts.map(post => post.author_id);
    const [profileMap, likesResult, commentsResult, mediaMap] = await Promise.all([
      visibleProfiles(authorIds),
      supabase.from("public_post_likes").select("post_id,user_id").in("post_id", ids),
      supabase.from("public_post_comments").select("post_id").in("post_id", ids),
      signedMedia(posts.map(post => post.media_path))
    ]);
    if (request !== loadSequence || panel.hidden || getCurrentUser()?.id !== user.id) return;
    if (likesResult.error || commentsResult.error) {
      setStatus("تعذر تحميل تفاعلات المنشورات.", "Could not load post interactions.", true);
    } else setStatus("", "");
    renderFeed(profileMap, likesResult.data || [], commentsResult.data || [], mediaMap);
  }

  function makeButton(label, className, action, ariaLabel = label) {
    const button = safeText("button", className, label);
    button.type = "button";
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", action);
    return button;
  }

  function renderFeed(profileMap = new Map(), likes = [], comments = [], mediaMap = new Map()) {
    list.replaceChildren();
    if (!posts.length) {
      list.append(safeText("li", "empty-item", t("لا توجد منشورات حتى الآن. كن أول من ينشر!", "No posts yet. Be the first to share!")));
      return;
    }
    const user = getCurrentUser();
    const likeCounts = new Map();
    const likedByMe = new Set();
    for (const like of likes) {
      likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
      if (like.user_id === user?.id) likedByMe.add(like.post_id);
    }
    const commentCounts = new Map();
    for (const comment of comments) commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1);

    for (const post of posts) {
      const profile = profileMap.get(post.author_id) || {};
      const name = profile.display_name?.trim() || t("مستخدم مرسال", "Mersal user");
      const item = document.createElement("li");
      item.className = "public-post-item";
      item.dataset.postId = post.id;
      const article = document.createElement("article");
      article.className = "public-post-card";
      article.setAttribute("aria-label", t("منشور بواسطة ", "Post by ") + name);
      const header = document.createElement("div");
      header.className = "public-post-header";
      const author = document.createElement("div");
      author.className = "public-post-author";
      if (profile.avatar_url) {
        const avatar = document.createElement("img");
        avatar.className = "public-post-avatar";
        avatar.src = profile.avatar_url;
        avatar.alt = "";
        avatar.loading = "lazy";
        avatar.setAttribute("aria-hidden", "true");
        author.append(avatar);
      }
      const authorName = safeText("span", "public-post-author-name", name);
      authorName.setAttribute("data-no-translate", "");
      author.append(authorName);
      const date = safeText("time", "public-post-date", dateFormat().format(new Date(post.created_at)));
      date.dateTime = post.created_at;
      header.append(author, date);
      article.append(header);

      if (post.body) {
        const body = safeText("p", "public-post-body", post.body);
        body.setAttribute("data-no-translate", "");
        article.append(body);
      }
      const mediaUrl = mediaMap.get(post.media_path);
      if (mediaUrl && post.media_type === "image") {
        const media = document.createElement("img");
        media.className = "public-post-media";
        media.src = mediaUrl;
        media.alt = t("صورة مرفقة بالمنشور", "Image attached to post");
        media.loading = "lazy";
        article.append(media);
      } else if (mediaUrl && post.media_type === "video") {
        const media = document.createElement("video");
        media.className = "public-post-media";
        media.src = mediaUrl;
        media.controls = true;
        media.playsInline = true;
        media.preload = "metadata";
        media.setAttribute("aria-label", t("فيديو مرفق بالمنشور", "Video attached to post"));
        article.append(media);
      }

      if (post.edited_at) article.append(safeText("span", "public-post-edited", t("تم التعديل", "Edited")));
      const actions = document.createElement("div");
      actions.className = "public-post-actions";
      const likeButton = makeButton(
        (likedByMe.has(post.id) ? t("إلغاء الإعجاب", "Unlike") : t("إعجاب", "Like")) + " · " + (likeCounts.get(post.id) || 0),
        "quiet-button public-post-like",
        () => { void toggleLike(post.id, likedByMe.has(post.id)); },
        t("إعجاب بالمنشور، عدد الإعجابات ", "Like post, likes ") + (likeCounts.get(post.id) || 0)
      );
      likeButton.setAttribute("aria-pressed", String(likedByMe.has(post.id)));
      const commentsButton = makeButton(
        t("التعليقات", "Comments") + " · " + (commentCounts.get(post.id) || 0),
        "quiet-button public-post-comments-toggle",
        () => { void toggleComments(item, post); },
        t("عرض التعليقات، عدد التعليقات ", "Show comments, comments ") + (commentCounts.get(post.id) || 0)
      );
      actions.append(likeButton, commentsButton);
      if (post.author_id === user?.id) {
        actions.append(makeButton(t("تعديل", "Edit"), "quiet-button", () => showEditForm(article, post)));
        actions.append(makeButton(t("حذف", "Delete"), "danger-button", () => { void deletePost(post); }));
      } else {
        actions.append(makeButton(t("إبلاغ", "Report"), "quiet-button", () => { void reportPost(post); }));
      }
      article.append(actions);
      item.append(article);
      list.append(item);
    }
  }

  async function toggleLike(postId, liked) {
    const user = getCurrentUser();
    if (!user) return;
    const button = list.querySelector('[data-post-id="' + postId + '"] .public-post-like');
    if (button) button.disabled = true;
    const result = liked
      ? await supabase.from("public_post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
      : await supabase.from("public_post_likes").insert({ post_id: postId, user_id: user.id });
    if (result.error) {
      announce(t("تعذر تحديث الإعجاب: ", "Could not update like: ") + result.error.message, "error");
      if (button) button.disabled = false;
      return;
    }
    await loadFeed(false);
  }

  async function toggleComments(item, post) {
    const existing = item.querySelector(".public-post-comments");
    if (existing) { existing.remove(); return; }
    const section = document.createElement("section");
    section.className = "public-post-comments";
    section.setAttribute("aria-label", t("تعليقات المنشور", "Post comments"));
    const heading = safeText("p", "public-post-comments-title", t("التعليقات", "Comments"));
    section.append(heading);
    const commentsList = document.createElement("ul");
    commentsList.className = "public-post-comments-list";
    commentsList.setAttribute("aria-label", t("قائمة التعليقات", "Comments list"));
    section.append(commentsList);
    const commentForm = document.createElement("form");
    commentForm.className = "public-post-comment-form";
    const input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = 1500;
    input.required = true;
    input.placeholder = t("اكتب تعليقًا", "Write a comment");
    input.setAttribute("aria-label", t("نص التعليق", "Comment text"));
    const send = safeText("button", "primary-button", t("إرسال التعليق", "Send comment"));
    send.type = "submit";
    commentForm.append(input, send);
    commentForm.addEventListener("submit", async event => {
      event.preventDefault();
      const user = getCurrentUser();
      const body = input.value.trim();
      if (!user || !body) return;
      send.disabled = true;
      const inserted = await supabase.from("public_post_comments").insert({ post_id: post.id, author_id: user.id, body });
      if (inserted.error) {
        announce(t("تعذر إرسال التعليق: ", "Could not send comment: ") + inserted.error.message, "error");
        send.disabled = false;
        return;
      }
      input.value = "";
      await renderComments(post.id, commentsList);
      await loadFeed(false);
      input.focus();
    });
    section.append(commentForm);
    item.querySelector(".public-post-card").append(section);
    await renderComments(post.id, commentsList);
    input.focus();
  }

  async function renderComments(postId, target) {
    target.replaceChildren(safeText("li", "empty-item", t("جارٍ تحميل التعليقات…", "Loading comments…")));
    const result = await supabase.from("public_post_comments")
      .select("id,post_id,author_id,body,created_at,edited_at")
      .eq("post_id", postId).order("created_at", { ascending: true }).limit(100);
    if (result.error) {
      target.replaceChildren(safeText("li", "empty-item", t("تعذر تحميل التعليقات.", "Could not load comments.")));
      return;
    }
    target.replaceChildren();
    if (!result.data?.length) {
      target.append(safeText("li", "empty-item", t("لا توجد تعليقات بعد.", "No comments yet.")));
      return;
    }
    const profiles = await visibleProfiles(result.data.map(comment => comment.author_id));
    for (const comment of result.data) {
      const profile = profiles.get(comment.author_id) || {};
      const name = profile.display_name?.trim() || t("مستخدم مرسال", "Mersal user");
      const row = document.createElement("li");
      row.className = "public-post-comment";
      const content = document.createElement("div");
      content.append(safeText("strong", "public-post-comment-author", name), safeText("p", "public-post-comment-body", comment.body));
      const meta = safeText("time", "public-post-comment-date", dateFormat().format(new Date(comment.created_at)));
      meta.dateTime = comment.created_at;
      row.append(content, meta);
      if (comment.author_id === getCurrentUser()?.id) {
        row.append(makeButton(t("حذف التعليق", "Delete comment"), "quiet-button", async () => {
          const deleted = await supabase.from("public_post_comments").delete().eq("id", comment.id).select("id").maybeSingle();
          if (deleted.error || !deleted.data) {
            announce(t("تعذر حذف التعليق.", "Could not delete comment."), "error");
            return;
          }
          await renderComments(postId, target);
          await loadFeed(false);
        }));
      }
      target.append(row);
    }
  }

  function showEditForm(article, post) {
    if (article.querySelector(".public-post-edit-form")) return;
    const form = document.createElement("form");
    form.className = "public-post-edit-form";
    const label = document.createElement("label");
    label.textContent = t("تعديل نص المنشور", "Edit post text");
    const input = document.createElement("textarea");
    input.rows = 4;
    input.maxLength = 5000;
    input.required = !post.media_path;
    input.value = post.body;
    input.setAttribute("aria-label", label.textContent);
    const save = safeText("button", "primary-button", t("حفظ التعديل", "Save edit"));
    save.type = "submit";
    const cancel = safeText("button", "quiet-button", t("إلغاء", "Cancel"));
    cancel.type = "button";
    cancel.addEventListener("click", () => form.remove());
    form.append(label, input, save, cancel);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      save.disabled = true;
      const updated = await supabase.from("public_posts").update({ body: input.value.trim(), edited_at: new Date().toISOString() }).eq("id", post.id).eq("author_id", getCurrentUser()?.id).select("id").maybeSingle();
      if (updated.error || !updated.data) {
        announce(t("تعذر تعديل المنشور.", "Could not edit post."), "error");
        save.disabled = false;
        return;
      }
      await loadFeed(false);
    });
    article.append(form);
    input.focus();
  }

  async function deletePost(post) {
    if (!window.confirm(t("هل تريد حذف هذا المنشور نهائيًا؟", "Delete this post permanently?"))) return;
    const result = await supabase.from("public_posts").delete().eq("id", post.id).eq("author_id", getCurrentUser()?.id).select("id").maybeSingle();
    if (result.error || !result.data) {
      announce(t("تعذر حذف المنشور.", "Could not delete post."), "error");
      return;
    }
    if (post.media_path) {
      const removed = await supabase.storage.from("mersal-attachments").remove([post.media_path]);
      if (removed.error) console.warn("Post media cleanup failed:", removed.error.message);
    }
    announce(t("تم حذف المنشور.", "Post deleted."), "success");
    await loadFeed(false);
  }

  async function reportPost(post) {
    if (!window.confirm(t("هل تريد الإبلاغ عن هذا المنشور لمراجعته؟", "Report this post for review?"))) return;
    const result = await supabase.from("public_post_reports").insert({ post_id: post.id, reporter_id: getCurrentUser()?.id, reason: "other" });
    if (result.error?.code === "23505") {
      announce(t("سبق أن أبلغت عن هذا المنشور.", "You have already reported this post."), "info");
      return;
    }
    if (result.error) {
      announce(t("تعذر إرسال البلاغ.", "Could not submit report."), "error");
      return;
    }
    announce(t("تم إرسال البلاغ للمراجعة.", "Report submitted for review."), "success");
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user || busy) return;
    const body = bodyInput.value.trim();
    const file = mediaInput.files?.[0] || null;
    if (!body && !file) {
      setStatus("اكتب نصًا أو أرفق صورة أو فيديو قبل النشر.", "Write something or attach a photo or video before posting.", true);
      bodyInput.focus();
      return;
    }
    if (body.length > 5000) return;
    if (file && (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
      setStatus("نوع الملف غير مدعوم. اختر صورة أو فيديو.", "Unsupported file. Choose an image or video.", true);
      return;
    }
    if (file && file.size > 50 * 1024 * 1024) {
      setStatus("الحد الأقصى لحجم الصورة أو الفيديو 50 ميغابايت.", "The maximum photo or video size is 50 MB.", true);
      return;
    }
    busy = true;
    submitButton.disabled = true;
    mediaInput.disabled = true;
    setStatus("جارٍ نشر المنشور…", "Publishing post…");
    let mediaPath = null;
    let mediaType = null;
    try {
      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        const extension = (file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") || (mediaType === "video" ? "mp4" : "jpg");
        mediaPath = "public-posts/" + user.id + "/" + crypto.randomUUID() + "." + extension;
        const upload = await supabase.storage.from("mersal-attachments").upload(mediaPath, file, {
          contentType: file.type, cacheControl: "3600", upsert: false
        });
        if (upload.error) throw upload.error;
      }
      const inserted = await supabase.from("public_posts").insert({
        author_id: user.id, body, media_path: mediaPath, media_type: mediaType
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      form.reset();
      mediaName.textContent = "";
      announce(t("تم نشر منشورك بنجاح.", "Your post was published."), "success");
      await loadFeed(false);
      bodyInput.focus();
    } catch (error) {
      if (mediaPath) await supabase.storage.from("mersal-attachments").remove([mediaPath]);
      setStatus(t("تعذر نشر المنشور: ", "Could not publish post: ") + (error.message || ""), "Could not publish post: " + (error.message || ""), true);
    } finally {
      busy = false;
      submitButton.disabled = false;
      mediaInput.disabled = false;
    }
  });

  mediaInput.addEventListener("change", () => {
    const file = mediaInput.files?.[0];
    mediaName.textContent = file ? t("المرفق المحدد: ", "Selected attachment: ") + file.name : "";
  });
  refreshButton.addEventListener("click", () => { void loadFeed(); });
  closeButton.addEventListener("click", () => close());
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  async function open(trigger) {
    const user = getCurrentUser();
    if (!user) return;
    returnFocus = trigger || document.activeElement;
    panel.hidden = false;
    document.body.classList.add("posts-open");
    localize();
    title.focus();
    await loadFeed();
    await startRealtime();
  }

  async function close(options = {}) {
    panel.hidden = true;
    document.body.classList.remove("posts-open");
    loadSequence++;
    await stopRealtime();
    if (options.restoreFocus !== false) returnFocus?.focus?.();
  }

  localize();
  return { open, close };
}
