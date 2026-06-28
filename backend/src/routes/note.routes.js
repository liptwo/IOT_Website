const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireOwnZone } = require('../middleware/requireRole');
const { db } = require('../config/firebase');

// POST /api/notes/:zoneId - Tạo ghi chú mới cho tình trạng cây
router.post('/:zoneId', authMiddleware, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  const { note } = req.body;

  // 1. Validate note content
  if (!note || typeof note !== 'string' || note.trim() === '') {
    return res.status(400).json({ error: 'Nội dung ghi chú (note) không được để trống' });
  }

  if (note.length > 500) {
    return res.status(400).json({ error: 'Nội dung ghi chú không được vượt quá 500 ký tự' });
  }

  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase Realtime Database chưa được khởi tạo' });
    }

    const newNote = {
      note: note.trim(),
      createdBy: req.user.uid,
      createdAt: Date.now()
    };

    // 2. Lưu ghi chú bằng key tự động sinh (push)
    const newNoteRef = db.ref(`plant_notes/${zoneId}`).push();
    await newNoteRef.set(newNote);

    res.status(201).json({
      message: 'Tạo ghi chú thành công',
      note: { id: newNoteRef.key, ...newNote }
    });
  } catch (error) {
    console.error(`[POST /api/notes/${zoneId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: 'Lỗi hệ thống khi lưu ghi chú' });
  }
});

// GET /api/notes/:zoneId - Lấy danh sách ghi chú của Zone (sắp xếp mới nhất trước)
router.get('/:zoneId', authMiddleware, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase Realtime Database chưa được khởi tạo' });
    }

    const snapshot = await db.ref(`plant_notes/${zoneId}`).once('value');
    const notesVal = snapshot.val();

    let notesList = [];
    if (notesVal) {
      notesList = Object.keys(notesVal).map(key => ({
        id: key,
        ...notesVal[key]
      }));
      // Sắp xếp theo thời gian mới nhất trước (createdAt giảm dần)
      notesList.sort((a, b) => b.createdAt - a.createdAt);
    }

    res.json(notesList);
  } catch (error) {
    console.error(`[GET /api/notes/${zoneId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: 'Lỗi hệ thống khi lấy danh sách ghi chú' });
  }
});

// DELETE /api/notes/:zoneId/:noteId - Xóa 1 ghi chú
router.delete('/:zoneId/:noteId', authMiddleware, requireOwnZone, async (req, res) => {
  const { zoneId, noteId } = req.params;

  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase Realtime Database chưa được khởi tạo' });
    }

    // 1. Đọc ghi chú ra trước để kiểm tra quyền sở hữu và sự tồn tại
    const noteRef = db.ref(`plant_notes/${zoneId}/${noteId}`);
    const snapshot = await noteRef.once('value');
    const note = snapshot.val();

    if (!note) {
      return res.status(404).json({ error: 'Không tìm thấy ghi chú này' });
    }

    // 2. Quyền xóa: ADMIN hoặc là tác giả của ghi chú đó
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = note.createdBy === req.user.uid;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa ghi chú của người khác' });
    }

    // 3. Thực hiện xóa ghi chú
    await noteRef.remove();

    res.json({ message: 'Xóa ghi chú thành công', noteId });
  } catch (error) {
    console.error(`[DELETE /api/notes/${zoneId}/${noteId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: 'Lỗi hệ thống khi xóa ghi chú' });
  }
});

module.exports = router;
