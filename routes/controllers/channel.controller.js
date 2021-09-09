const createError = require('http-errors');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const Channel = require('../../models/Channel');
const { ERR_MSG } = require('../../constants/errors/errorMessage');
const { VALIDATION_MSG } = require('../../constants/errors/validationMessage');

exports.getChannels = async (_, res, next) => {
  try {
    const channels = await Channel.find().lean();

    res.status(200).json({
      result: 'ok',
      data: channels,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.INVALID_DATA,
      });
    }

    next(createError(500, ERR_MSG.SERVER_ERR));
  }
};

exports.getChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId)
      .populate('episode')
      .populate('host')
      .populate({
        path: 'audience',
        model: 'User',
      })
      .populate({
        path: 'players',
        populate: {
          path: 'userId',
          model: 'User',
        },
      })
      .populate({
        path: 'players',
        populate: {
          path: 'characterId',
          model: 'Character',
        },
      });

    res.json({
      result: 'ok',
      data: channel,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.INVALID_DATA,
      });
    }

    next(createError(500, ERR_MSG.SERVER_ERR));
  }
};

exports.createChannel = async (req, res, next) => {
  try {
    const { name, episodeId, userId } = req.body;

    if (await Channel.exists({ name })) {
      return res.status(400).json({
        result: 'error',
        message: VALIDATION_MSG.ALREADY_EXIST,
      });
    }

    const newChannel = await Channel.create({
      name,
      episode: episodeId,
      host: userId,
    });

    res.json({
      result: 'ok',
      data: newChannel,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.INVALID_DATA,
      });
    }

    next(createError(500, ERR_MSG.SERVER_ERR));
  }
};

exports.getUserType = async (req, res, next) => {
  try {
    const { channelId, userId } = req.params;
    const { audience } = await Channel.findById(channelId);
    const audienceIdList = audience.map((user) => user._id.toString());
    const isAudience = audienceIdList.some((audience) => audience === userId);

    res.json({
      result: 'ok',
      data: { type: isAudience ? 'audience' : 'player', userId },
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.INVALID_DATA,
      });
    }

    next(createError(500, ERR_MSG.SERVER_ERR));
  }
};

exports.updateChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { state, userId, type, characterId } = req.body;

    if (!ObjectId.isValid(channelId)) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.BAD_REQUEST,
      });
    }

    const targetChannel = await Channel.findById(channelId);

    if (targetChannel === null) {
      return next(createError(500, ERR_MSG.SERVER_ERR));
    }

    const { players, audience } = targetChannel;

    switch (state) {
      case 'voting': {
        const user = players.find((player) => {
          player.userId.toString() === userId;
        });
        user.voteCount++;

        break;
      }

      case 'enter': {
        type === 'audience' ? audience.push(userId) : players.push({ userId });

        break;
      }

      case 'exit': {
        type === 'audience'
          ? (targetChannel.audience = audience.filter(
              (user) => user.toString() !== userId,
            ))
          : (targetChannel.players = players.filter((player) => {
              player.userId.toString() !== userId;
            }));

        break;
      }

      case 'start': {
        targetChannel.isPlaying = true;

        break;
      }

      case 'end': {
        targetChannel.isActive = false;

        break;
      }

      case 'character': {
        const player = players.find((player) => {
          player.userId.toString() === userId;
        });
        player.characterId = characterId;

        break;
      }

      default:
        break;
    }

    await targetChannel.save();

    res.json({
      result: 'ok',
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        result: 'error',
        message: ERR_MSG.INVALID_DATA,
      });
    }

    next(createError(500, ERR_MSG.SERVER_ERR));
  }
};
