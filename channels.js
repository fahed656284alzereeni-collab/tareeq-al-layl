const $ = (selector) => document.querySelector(selector);

export function initMersalChannels({ supabase, getCurrentUser, announce, safeText }) {
  const panel = $("#channels-panel");
  const closeButton = $("#channels-close");
  const openButton = $("#open-channels-button");
  const home = $("#channels-home-view");
  const createView = $("#channels-create-view");
  const detailView = $("#channel-detail-view");
  const title = $("#channels-title");
  const list = $("#channels-list");
  const search = $("#channels-search");
  const createButton = $("#channel-create-button");
  const cancelCreateButton = $("#channel-create-cancel");
  const createForm = $("#channel-create-form");
  const nameInput = $("#channel-name-input");
  const descriptionInput = $("#channel-description-input");
  const detailBack = $("#channel-detail-back");
  const detailName = $("#channel-detail-name");
  const detailDescription = $("#channel-detail-description");
  const followButton = $("#channel-follow-toggle");
  const notificationsButton = $("#channel-notifications-toggle");
  const deleteChannelButton = $("#channel-delete-button");
  const editOpenButton = $("#channel-edit-open");
  const editForm = $("#channel-edit-form");
  const editNameInput = $("#channel-edit-name");
  const editDescriptionInput = $("#channel-edit-description");
  const editSaveButton = $("#channel-edit-save");
  const editCancelButton = $("#channel-edit-cancel");
  const postForm = $("#channel-post-form");
  const postInput = $("#channel-post-input");
  const postsList = $("#channel-posts");
  const status = $("#channels-status");

  let rows = [];
  let activeChannel = null;
  let activeFollow = null;
  let returnFocus = null;
  let busy = false;
  let postsRealtimeChannel = null;

  const isEnglish = () => document.documentElement.lang === "en";
  const t = (ar, en) => isEnglish() ? en : ar;

  function localize() {
    const en = isEnglish();
    const setText = (node, ar, english) => { if (node) node.textContent = en ? english : ar; };
    const setAttr = (node, name, ar, english) => { if (node) node.setAttribute(name, en ? english : ar); };
    setText(title, "القنوات", "Channels");
    setText($("#channels-intro"), "تابع القنوات العامة أو أنشئ قناة لنشر التحديثات.", "Follow public channels or create your own channel to share updates.");
    setText(createButton, "إنشاء قناة", "Create channel");
    setText(closeButton, "إغلاق", "Close");
    setText(cancelCreateButton, "إلغاء", "Cancel");
    setText($("#channels-create-view .channels-title"), "إنشاء قناة", "Create channel");
    setText($("#channel-post-form label"), "تحديث جديد", "New update");
    setText($("#channel-create-form label[for='channel-name-input']"), "اسم القناة", "Channel name");
    setText($("#channel-create-form label[for='channel-description-input']"), "وصف القناة", "Channel description");
    setAttr(list, "aria-label", "القنوات العامة", "Public channels");
    setAttr(postsList, "aria-label", "تحديثات القناة", "Channel updates");
    setText($("#channel-create-save"), "حفظ القناة", "Save channel");
    setText(detailBack, "العودة إلى القنوات", "Back to channels");
    setText($("#channel-post-submit"), "نشر التحديث", "Publish update");
    setText(deleteChannelButton, "حذف القناة", "Delete channel");
    setText(notificationsButton, activeFollow?.notifications_enabled === false ? "تشغيل إشعارات القناة" : "إيقاف إشعارات القناة", activeFollow?.notifications_enabled === false ? "Turn on channel notifications" : "Turn off channel notifications");
    setText(editOpenButton, "تعديل معلومات القناة", "Edit channel details");
    setText($("#channel-edit-save"), "حفظ التعديلات", "Save changes");
    setText(editCancelButton, "إلغاء", "Cancel");
    setAttr(editNameInput, "aria-label", "اسم القناة", "Channel name");
    setAttr(editDescriptionInput, "aria-label", "وصف القناة", "Channel description");
    setText($("#channel-edit-form label[for='channel-edit-name']"), "اسم القناة", "Channel name");
    setText($("#channel-edit-form label[for='channel-edit-description']"), "وصف القناة", "Channel description");
    if (editNameInput) editNameInput.placeholder = t("اسم القناة", "Channel name");
    if (editDescriptionInput) editDescriptionInput.placeholder = t("وصف مختصر للقناة", "A short channel description");
    setAttr(panel, "aria-label", "القنوات", "Channels");
    setAttr(closeButton, "aria-label", "إغلاق القنوات", "Close channels");
    setAttr(nameInput, "aria-label", "اسم القناة", "Channel name");
    setAttr(descriptionInput, "aria-label", "وصف القناة", "Channel description");
    setAttr(search, "aria-label", "البحث في القنوات", "Search channels");
    setAttr(postInput, "aria-label", "اكتب تحديث القناة", "Write a channel update");
    if (search) search.placeholder = t("ابحث عن قناة", "Search channels");
    if (nameInput) nameInput.placeholder = t("اسم القناة", "Channel name");
    if (descriptionInput) descriptionInput.placeholder = t("وصف مختصر للقناة", "A short channel description");
    if (postInput) postInput.placeholder = t("اكتب تحديثًا لمتابعي القناة", "Write an update for channel followers");
    if (activeChannel) {
      followButton.textContent = activeFollow ? t("إلغاء المتابعة", "Unfollow") : t("متابعة القناة", "Follow channel");
      followButton.setAttribute("aria-pressed", String(Boolean(activeFollow)));
      followButton.setAttribute("aria-label", followButton.textContent);
      if (notificationsButton) {
        notificationsButton.hidden = !activeFollow;
        notificationsButton.setAttribute("aria-pressed", String(Boolean(activeFollow?.notifications_enabled)));
        notificationsButton.setAttribute("aria-label", notificationsButton.textContent);
      }
    }
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "lang")) {
      localize();
      if (!panel.hidden && !detailView.hidden && activeChannel) void renderPosts(activeChannel.id);
      else if (!panel.hidden && !home.hidden) renderList();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function setStatus(ar, en, isError = false) {
    if (!status) return;
    status.textContent = t(ar, en);
    status.setAttribute("role", isError ? "alert" : "status");
  }

  async function loadChannels() {
    const user = getCurrentUser();
    if (!user) return;
    setStatus("جارٍ تحميل القنوات…", "Loading channels…");
    const [channelsResult, followsResult] = await Promise.all([
      supabase.from("channels").select("id,owner_id,name,description,created_at,updated_at")
        .eq("is_public", true).order("updated_at", { ascending: false }).limit(100),
      supabase.from("channel_followers").select("channel_id,notifications_enabled")
        .eq("follower_id", user.id)
    ]);
    if (channelsResult.error) throw channelsResult.error;
    if (followsResult.error) throw followsResult.error;
    const follows = new Map((followsResult.data || []).map(row => [row.channel_id, row]));
    const ownedIds = new Set((channelsResult.data || []).filter(row => row.owner_id === user.id).map(row => row.id));
    rows = (channelsResult.data || []).map(row => ({ ...row, followed: follows.get(row.id) || null, owned: ownedIds.has(row.id) }));
    renderList();
    setStatus(rows.length ? "" : "لا توجد قنوات عامة بعد.", "No public channels yet.");
  }

  function renderList() {
    if (!list) return;
    const query = (search?.value || "").trim().toLocaleLowerCase();
    const filtered = rows.filter(row => (row.name + " " + (row.description || "")).toLocaleLowerCase().includes(query));
    list.replaceChildren();
    if (!filtered.length) {
      list.append(safeText("li", "empty-item", t("لا توجد قنوات مطابقة.", "No matching channels.")));
      return;
    }
    for (const channel of filtered) {
      const item = document.createElement("li");
      item.className = "channel-list-item";
      const open = safeText("button", "channel-open-button", channel.name);
      open.type = "button";
      open.setAttribute("aria-label", t("فتح قناة ", "Open channel ") + channel.name);
      open.setAttribute("data-no-translate", "");
      const description = safeText("p", "channel-list-description", channel.description || t("لا يوجد وصف للقناة.", "No channel description."));
      description.setAttribute("data-no-translate", "");
      const meta = safeText("span", "channel-list-meta", channel.owned ? t("قناتك", "Your channel") : channel.followed ? t("تتابعها", "Following") : t("قناة عامة", "Public channel"));
      open.addEventListener("click", () => { void openChannel(channel, open); });
      item.append(open, description, meta);
      list.append(item);
    }
  }

  async function stopPostsRealtime() {
    if (!postsRealtimeChannel) return;
    const channel = postsRealtimeChannel;
    postsRealtimeChannel = null;
    await supabase.removeChannel(channel);
  }

  async function startPostsRealtime(channelId) {
    await stopPostsRealtime();
    postsRealtimeChannel = supabase.channel("mersal-channel-posts-" + channelId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "channel_posts", filter: "channel_id=eq." + channelId
      }, () => {
        if (activeChannel?.id === channelId && !detailView.hidden) void renderPosts(channelId);
      })
      .subscribe();
  }

  function showHome() {
    void stopPostsRealtime();
    activeChannel = null;
    activeFollow = null;
    createView.hidden = true;
    detailView.hidden = true;
    home.hidden = false;
    localize();
  }

  function open(returnElement = openButton) {
    if (!getCurrentUser() || !panel) return;
    returnFocus = returnElement || openButton;
    panel.hidden = false;
    showHome();
    void loadChannels().catch(error => setStatus("تعذر تحميل القنوات: " + (error.message || ""), "Could not load channels: " + (error.message || ""), true));
    closeButton.focus();
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    showHome();
    if (returnFocus?.isConnected) returnFocus.focus();
    else openButton?.focus();
  }

  async function openChannel(channel, trigger) {
    const user = getCurrentUser();
    activeChannel = channel;
    const followResult = await supabase.from("channel_followers")
      .select("channel_id,notifications_enabled").eq("channel_id", channel.id)
      .eq("follower_id", user.id).maybeSingle();
    if (followResult.error) {
      announce(t("تعذر فتح القناة: ", "Could not open channel: ") + followResult.error.message, "error");
      return;
    }
    activeFollow = followResult.data || null;
    home.hidden = true;
    createView.hidden = true;
    detailView.hidden = false;
    detailName.textContent = channel.name;
    detailName.setAttribute("data-no-translate", "");
    detailDescription.textContent = channel.description || t("لا يوجد وصف للقناة.", "No channel description.");
    detailDescription.setAttribute("data-no-translate", "");
    const own = channel.owner_id === user.id;
    followButton.hidden = own;
    notificationsButton.hidden = own || !activeFollow;
    postForm.hidden = !own;
    deleteChannelButton.hidden = !own;
    editOpenButton.hidden = !own;
    editForm.hidden = true;
    localize();
    await renderPosts(channel.id);
    void startPostsRealtime(channel.id);
    detailBack.focus();
  }

  async function renderPosts(channelId) {
    const result = await supabase.from("channel_posts")
      .select("id,channel_id,author_id,body,created_at,edited_at,is_deleted")
      .eq("channel_id", channelId).order("created_at", { ascending: false }).limit(100);
    if (result.error) {
      postsList.replaceChildren(safeText("li", "empty-item", t("تعذر تحميل تحديثات القناة.", "Could not load channel updates.")));
      return;
    }
    postsList.replaceChildren();
    if (!result.data?.length) {
      postsList.append(safeText("li", "empty-item", t("لا توجد تحديثات في هذه القناة بعد.", "No updates in this channel yet.")));
      return;
    }
    for (const post of result.data) {
      const item = document.createElement("li");
      item.className = "channel-post-item";
      const body = safeText("p", "channel-post-body", post.is_deleted ? t("حذف مالك القناة هذا التحديث.", "The channel owner deleted this update.") : post.body);
      body.setAttribute("data-no-translate", "");
      const time = safeText("time", "channel-post-time", new Intl.DateTimeFormat(isEnglish() ? "en" : "ar-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.created_at)));
      item.append(body, time);
      if (post.edited_at && !post.is_deleted) item.append(safeText("span", "channel-post-edited", t("تم التعديل", "Edited")));
      if (activeChannel?.owner_id === getCurrentUser()?.id && !post.is_deleted) {
        const actions = document.createElement("div");
        actions.className = "channel-post-actions";
        const edit = safeText("button", "quiet-button", t("تعديل", "Edit"));
        edit.type = "button";
        edit.addEventListener("click", () => {
          if (item.querySelector(".channel-post-edit-form")) return;
          const editor = document.createElement("form");
          editor.className = "channel-post-edit-form";
          const label = document.createElement("label");
          label.textContent = t("تعديل تحديث القناة", "Edit channel update");
          const textarea = document.createElement("textarea");
          textarea.id = "channel-post-edit-" + post.id;
          textarea.rows = 4;
          textarea.maxLength = 5000;
          textarea.required = true;
          textarea.value = post.body;
          textarea.setAttribute("aria-label", t("نص تحديث القناة", "Channel update text"));
          label.htmlFor = textarea.id;
          const controls = document.createElement("div");
          controls.className = "channel-post-actions";
          const save = safeText("button", "primary-button", t("حفظ", "Save"));
          save.type = "submit";
          const cancel = safeText("button", "quiet-button", t("إلغاء", "Cancel"));
          cancel.type = "button";
          controls.append(save, cancel);
          editor.append(label, textarea, controls);
          item.insertBefore(editor, actions);
          body.hidden = true;
          actions.hidden = true;
          textarea.focus();
          cancel.addEventListener("click", () => {
            editor.remove();
            body.hidden = false;
            actions.hidden = false;
            edit.focus();
          });
          editor.addEventListener("submit", async event => {
            event.preventDefault();
            const bodyValue = textarea.value.trim();
            if (!bodyValue || bodyValue.length > 5000) {
              announce(t("يجب أن يكون التحديث من حرف واحد إلى 5000 حرف.", "The update must contain 1 to 5000 characters."), "error");
              textarea.focus();
              return;
            }
            save.disabled = true;
            const update = await supabase.from("channel_posts")
              .update({ body: bodyValue, edited_at: new Date().toISOString() })
              .eq("id", post.id).eq("channel_id", channelId).select("id").maybeSingle();
            if (update.error || !update.data) {
              save.disabled = false;
              announce(t("تعذر تعديل التحديث: ", "Could not edit update: ") + (update.error?.message || t("لم يتم حفظ التعديل.", "The update was not saved.")), "error");
              return;
            }
            await renderPosts(channelId);
            announce(t("تم تعديل التحديث.", "Update edited."));
          });
        });
        const remove = safeText("button", "danger-button", t("حذف", "Delete"));
        remove.type = "button";
        remove.addEventListener("click", async () => {
          if (!window.confirm(t("هل تريد حذف هذا التحديث؟", "Delete this update?"))) return;
          remove.disabled = true;
          const update = await supabase.from("channel_posts").update({ is_deleted: true })
            .eq("id", post.id).eq("channel_id", channelId);
          if (update.error) {
            remove.disabled = false;
            announce(t("تعذر حذف التحديث: ", "Could not delete update: ") + update.error.message, "error");
            return;
          }
          await renderPosts(channelId);
          announce(t("تم حذف التحديث.", "Update deleted."));
        });
        actions.append(edit, remove);
        item.append(actions);
      }
      postsList.append(item);
    }
  }

  createButton.addEventListener("click", () => {
    nameInput.value = "";
    descriptionInput.value = "";
    home.hidden = true;
    detailView.hidden = true;
    createView.hidden = false;
    localize();
    nameInput.focus();
  });

  cancelCreateButton.addEventListener("click", () => {
    showHome();
    createButton.focus();
  });

  createForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const user = getCurrentUser();
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    if (!name || name.length > 80 || description.length > 500) {
      announce(t("اسم القناة مطلوب (حتى 80 حرفًا)، والوصف حتى 500 حرف.", "A channel name is required (up to 80 characters); description is limited to 500."), "error");
      nameInput.focus();
      return;
    }
    busy = true;
    $("#channel-create-save").disabled = true;
    const result = await supabase.from("channels").insert({ owner_id: user.id, name, description, is_public: true })
      .select("id,owner_id,name,description,created_at,updated_at").single();
    busy = false;
    $("#channel-create-save").disabled = false;
    if (result.error) {
      announce(t("تعذر إنشاء القناة: ", "Could not create channel: ") + result.error.message, "error");
      return;
    }
    rows.unshift({ ...result.data, followed: null, owned: true });
    showHome();
    renderList();
    announce(t("تم إنشاء القناة.", "Channel created."));
    await openChannel(result.data, createButton);
  });

  followButton.addEventListener("click", async () => {
    if (!activeChannel || busy) return;
    busy = true;
    followButton.disabled = true;
    const user = getCurrentUser();
    const result = activeFollow
      ? await supabase.from("channel_followers").delete().eq("channel_id", activeChannel.id).eq("follower_id", user.id)
      : await supabase.from("channel_followers").insert({ channel_id: activeChannel.id, follower_id: user.id });
    followButton.disabled = false;
    busy = false;
    if (result.error) {
      announce(t("تعذر تحديث المتابعة: ", "Could not update following: ") + result.error.message, "error");
      return;
    }
    activeFollow = activeFollow ? null : { channel_id: activeChannel.id, notifications_enabled: true };
    const index = rows.findIndex(row => row.id === activeChannel.id);
    if (index >= 0) rows[index].followed = activeFollow;
    localize();
    renderList();
    announce(activeFollow ? t("أصبحت تتابع القناة.", "You are now following this channel.") : t("ألغيت متابعة القناة.", "You unfollowed this channel."));
  });

  notificationsButton.addEventListener("click", async () => {
    if (!activeChannel || !activeFollow || busy) return;
    busy = true;
    notificationsButton.disabled = true;
    const enabled = !activeFollow.notifications_enabled;
    const result = await supabase.from("channel_followers")
      .update({ notifications_enabled: enabled })
      .eq("channel_id", activeChannel.id)
      .eq("follower_id", getCurrentUser().id)
      .select("channel_id,notifications_enabled").maybeSingle();
    busy = false;
    notificationsButton.disabled = false;
    if (result.error || !result.data) {
      announce(t("تعذر تحديث إعداد الإشعارات: ", "Could not update notification setting: ") + (result.error?.message || t("لم يتم حفظ التغيير.", "The change was not saved.")), "error");
      return;
    }
    activeFollow = result.data;
    localize();
    announce(enabled ? t("تم تشغيل إشعارات القناة.", "Channel notifications are on.") : t("تم إيقاف إشعارات القناة.", "Channel notifications are off."));
  });

  postForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!activeChannel || activeChannel.owner_id !== getCurrentUser()?.id || busy) return;
    const body = postInput.value.trim();
    if (!body || body.length > 5000) {
      announce(t("اكتب تحديثًا من حرف واحد إلى 5000 حرف.", "Write an update between 1 and 5000 characters."), "error");
      postInput.focus();
      return;
    }
    busy = true;
    $("#channel-post-submit").disabled = true;
    const result = await supabase.from("channel_posts").insert({
      channel_id: activeChannel.id, author_id: getCurrentUser().id, body
    });
    busy = false;
    $("#channel-post-submit").disabled = false;
    if (result.error) {
      announce(t("تعذر نشر التحديث: ", "Could not publish update: ") + result.error.message, "error");
      return;
    }
    postInput.value = "";
    await renderPosts(activeChannel.id);
    announce(t("تم نشر التحديث.", "Update published."));
  });


  editOpenButton.addEventListener("click", () => {
    if (!activeChannel || activeChannel.owner_id !== getCurrentUser()?.id) return;
    editNameInput.value = activeChannel.name || "";
    editDescriptionInput.value = activeChannel.description || "";
    editForm.hidden = false;
    editOpenButton.hidden = true;
    editSaveButton.disabled = true;
    editNameInput.focus();
  });

  const updateEditSaveState = () => {
    const changed = editNameInput.value.trim() !== (activeChannel?.name || "") ||
      editDescriptionInput.value.trim() !== (activeChannel?.description || "");
    editSaveButton.disabled = !changed || !editNameInput.value.trim() || editNameInput.value.trim().length > 80 ||
      editDescriptionInput.value.trim().length > 500 || busy;
  };
  editNameInput.addEventListener("input", updateEditSaveState);
  editDescriptionInput.addEventListener("input", updateEditSaveState);
  editCancelButton.addEventListener("click", () => {
    editForm.reset();
    editForm.hidden = true;
    editOpenButton.hidden = !activeChannel || activeChannel.owner_id !== getCurrentUser()?.id;
    editOpenButton.focus();
  });
  editForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!activeChannel || activeChannel.owner_id !== getCurrentUser()?.id || busy) return;
    const name = editNameInput.value.trim();
    const description = editDescriptionInput.value.trim();
    if (!name || name.length > 80 || description.length > 500) {
      announce(t("اسم القناة مطلوب حتى 80 حرفًا، والوصف حتى 500 حرف.", "A channel name is required (up to 80 characters); description is limited to 500."), "error");
      editNameInput.focus();
      return;
    }
    if (name === activeChannel.name && description === (activeChannel.description || "")) {
      editSaveButton.disabled = true;
      return;
    }
    busy = true;
    editSaveButton.disabled = true;
    const result = await supabase.from("channels")
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq("id", activeChannel.id).eq("owner_id", getCurrentUser().id)
      .select("id,owner_id,name,description,created_at,updated_at").maybeSingle();
    busy = false;
    if (result.error || !result.data) {
      announce(t("تعذر حفظ معلومات القناة: ", "Could not save channel details: ") + (result.error?.message || t("لم يتم تحديث القناة.", "The channel was not updated.")), "error");
      updateEditSaveState();
      return;
    }
    activeChannel = { ...activeChannel, ...result.data };
    const index = rows.findIndex(row => row.id === activeChannel.id);
    if (index >= 0) rows[index] = { ...rows[index], ...result.data };
    detailName.textContent = result.data.name;
    detailDescription.textContent = result.data.description || t("لا يوجد وصف للقناة.", "No channel description.");
    editForm.hidden = true;
    editOpenButton.hidden = false;
    renderList();
    announce(t("تم تحديث معلومات القناة.", "Channel details updated."));
    editOpenButton.focus();
  });

  deleteChannelButton.addEventListener("click", async () => {
    if (!activeChannel || activeChannel.owner_id !== getCurrentUser()?.id || busy) return;
    if (!window.confirm(t("حذف القناة سيحذف متابعيها وتحديثاتها. هل تريد المتابعة؟", "Deleting this channel also deletes its followers and updates. Continue?"))) return;
    busy = true;
    deleteChannelButton.disabled = true;
    const result = await supabase.from("channels").delete().eq("id", activeChannel.id).eq("owner_id", getCurrentUser().id);
    deleteChannelButton.disabled = false;
    busy = false;
    if (result.error) {
      announce(t("تعذر حذف القناة: ", "Could not delete channel: ") + result.error.message, "error");
      return;
    }
    activeChannel = null;
    showHome();
    await loadChannels();
    announce(t("تم حذف القناة.", "Channel deleted."));
    createButton.focus();
  });

  detailBack.addEventListener("click", () => {
    showHome();
    renderList();
    title.focus();
  });
  search.addEventListener("input", renderList);
  closeButton.addEventListener("click", close);
  panel.addEventListener("click", event => { if (event.target === panel) close(); });
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!createView.hidden) { showHome(); createButton.focus(); }
      else if (!detailView.hidden) { showHome(); title.focus(); }
      else close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden]),textarea:not([disabled]):not([hidden]),[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.closest("[hidden]") && element.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); closeButton.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  localize();
  return { open, close };
}
