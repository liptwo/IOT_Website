const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireOwnZone } = require('../middleware/requireRole');
const { db } = require('../config/firebase');

// Lấy danh sách ghi chú của Zone
// GET /api/notes/:zoneId
router.get('/:zoneId', authMiddleware, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (db) {
      const snapshot = await db.ref(`zones/${zoneId}/notes`).once('value');
      const notesVal = snapshot.val();
      const notesList = notesVal ? Object.keys(notesVal).map(key => ({ id: key, ...notesVal[key] })) : [];
      return res.json(notesList);
    } else {
      // Mock data
      return res.json([
        { id: '1', zoneId, content: 'Cây phát triển bình thường, lá xanh.', createdAt: new Date().toISOString(), author: 'admin' }
      ]);
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách ghi chú', error: error.message });
  }
});

// Tạo ghi chú mới cho tình trạng cây
// POST /api/notes/:zoneId
router.post('/:zoneId', authMiddleware, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ message: 'Nội dung ghi chú không được để trống' });
  }

  try {
    const newNote = {
      content,
      createdAt: new Date().toISOString(),
      author: req.user.username || 'unknown'
    };

    if (db) {
      const newNoteRef = db.ref(`zones/${zoneId}/notes`).push();
      await newNoteRef.set(newNote);
      return res.status(201).json({ message: 'Tạo ghi chú thành công', note: { id: newNoteRef.key, ...newNote } });
    } else {
      return res.status(201).json({
        message: '[Mock] Tạo ghi chú thành công (chưa kết nối Firebase)',
        note: { id: Date.now().toString(), ...newNote }
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lưu ghi chú', error: error.message });
  }
});

module.exports = router;
