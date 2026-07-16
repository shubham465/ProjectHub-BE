'use strict';

/**
 * Socket.IO room event handlers.
 * Registered once per connected socket inside initSocket().
 *
 * Events:
 *   JOIN_PROJECT_ROOM  { projectId }  — subscribe socket to "project:<id>" room
 *   LEAVE_PROJECT_ROOM { projectId }  — unsubscribe socket from "project:<id>" room
 */

const roomName = (projectId) => `project:${projectId}`;

const registerHandlers = (socket) => {
  socket.on('JOIN_PROJECT_ROOM', ({ projectId } = {}) => {
    if (!projectId) return;
    socket.join(roomName(projectId));
  });

  socket.on('LEAVE_PROJECT_ROOM', ({ projectId } = {}) => {
    if (!projectId) return;
    socket.leave(roomName(projectId));
  });
};

module.exports = { registerHandlers, roomName };
