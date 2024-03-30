import './App.css';
import { useState } from 'react';
import { Button, Image, Flex, message, Spin, Modal, Input, Form } from 'antd';
import { invoke } from '@tauri-apps/api';

interface ImageParams {
  image_base64: string;
  image_path: string;
}

enum ERR_MSG {
  SettingErr = '请设置保存路径和API Key',
  CutoutErr = '抠图失败',
  UploadImageErr = '请上传图片'
}

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [spinning, setSpinning] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadImage, setUploadImage] = useState<ImageParams>({
    image_base64: '',
    image_path: ''
  });
  const [mattingImage, setMattingImage] = useState<ImageParams>({
    image_base64: '',
    image_path: ''
  });

  const success = () => {
    messageApi.open({
      type: 'success',
      content: '处理完成',
    });
  };

  const error = (errType: keyof typeof ERR_MSG) => {
    messageApi.open({
      type: 'error',
      content: ERR_MSG[errType],
    });
  };

  const showModal = () => {
    const str = window.localStorage.getItem('SETTING') || '';
    const setting: { savePath: string, apiKey: string } | '' = !str ? '' : JSON.parse(str);
    if (setting) {
      form.setFieldsValue(setting);
    }
    setIsModalOpen(true);
  };

  const handleOk = () => {
    form.validateFields().then(() => {
      window.localStorage.setItem('SETTING', JSON.stringify(form.getFieldsValue()));
      setIsModalOpen(false);
    });
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const upload = async () => {
    const res = await invoke<ImageParams>('open_image');
    if (!res.image_path || !res.image_base64) {
      return;
    }
    setMattingImage({
      image_base64: '',
      image_path: ''
    });
    setUploadImage({
      image_base64: res.image_base64,
      image_path: res.image_path
    });
  };

  const selectSavePath = async () => {
    const res = await invoke<string>('save_matting_image_path');
    form.setFieldValue('savePath', res);
  };

  const cutout = () => {
    if (!uploadImage.image_path) {
      error('UploadImageErr');
      return;
    }
    const str = window.localStorage.getItem('SETTING') || '';
    const setting: { savePath: string, apiKey: string } | '' = !str ? '' : JSON.parse(str);
    if (!setting || !setting.savePath || !setting.apiKey) {
      error('SettingErr');
      return;
    }
    setSpinning(true);
    invoke<ImageParams>('matting_image', {
      filePath: uploadImage.image_path,
      savePath: setting.savePath,
      apiKey: setting.apiKey
    }).then(
      res => {
        setMattingImage({
          image_base64: res.image_base64,
          image_path: res.image_path
        });
        setSpinning(false);
        success();
      },
      (err: any) => {
        setSpinning(false);
        error('CutoutErr');
        console.log(err);
      }
    );
  };

  return (
    <div className="container">
      { contextHolder }
      <Spin spinning={ spinning } fullscreen/>
      <Modal title="设置" open={ isModalOpen } onOk={ handleOk } onCancel={ handleCancel }>
        <Form
          name="设置"
          autoComplete="off"
          labelAlign="right"
          form={ form }
        >
          <div style={ {
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            height: 'auto'
          } }>
            <div style={ {
              flex: '1',
              paddingRight: '10px'
            } }>
              <Form.Item
                label="保存地址"
                name="savePath"
                rules={ [{ required: true, message: '请选择保存地址' }] }
              >
                <Input disabled/>
              </Form.Item>
            </div>
            <Button type="primary" onClick={ selectSavePath }>请选择</Button>
          </div>
          <Form.Item
            label="Api Key"
            name="apiKey"
            rules={ [{ required: true, message: '请输入Api Key' }] }
          >
            <Input/>
          </Form.Item>
        </Form>
      </Modal>
      <div className="image_wrap">
        <div>
          <Image src={ uploadImage.image_base64 }/>
        </div>
        <div>
          <Image src={ mattingImage.image_base64 }/>
        </div>
      </div>
      <Flex gap="small" wrap="wrap" justify="center" align="center">
        <Button type="primary" onClick={ upload }>打开文件</Button>
        <Button type="primary" onClick={ cutout }>抠图</Button>
        <Button type="primary" onClick={ showModal }>设置</Button>
      </Flex>
    </div>
  );
}

export default App;
