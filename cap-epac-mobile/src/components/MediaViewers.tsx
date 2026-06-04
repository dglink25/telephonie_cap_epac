// src/components/MediaViewers.tsx
import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Video from 'react-native-video';
import ImageView from 'react-native-image-viewing';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../utils/constants';
import { getMediaUrl } from '../services/api';

const { width, height } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: Array<{ file_url: string }>;
  imageIndex: number;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  images,
  imageIndex,
  onClose,
}) => {
  const imageUrls = images.map(img => ({
    uri: getMediaUrl(img.file_url),
  }));

  return (
    <ImageView
      images={imageUrls}
      imageIndex={imageIndex}
      visible={visible}
      onRequestClose={onClose}
    />
  );
};

interface VideoPlayerProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  visible,
  videoUrl,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.videoModal}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Icon name="close" size={30} color={COLORS.white} />
        </TouchableOpacity>
        
        <Video
          source={{ uri: videoUrl }}
          style={styles.video}
          controls={true}
          resizeMode="contain"
          onError={(error) => console.error('[Video] Error:', error)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  videoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  video: {
    width: width,
    height: height - 100,
  },
});
