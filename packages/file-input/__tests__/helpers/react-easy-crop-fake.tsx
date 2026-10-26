import { passThroughModule } from '@ttt-productions/dev-standards/testing';

type ReactEasyCrop = typeof import('react-easy-crop');

// jsdom cannot run the real cropper; it reports one crop area once, like the library does.
export async function reactEasyCropFake(
  importOriginal: () => Promise<ReactEasyCrop>,
): Promise<ReactEasyCrop> {
  const actual = await importOriginal();
  class ReportingCropper extends actual.default {
    override componentDidMount() {
      this.props.onCropComplete?.(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 0, y: 0, width: 10, height: 10 },
      );
    }
    override componentDidUpdate() {}
    override componentWillUnmount() {}
    override render() {
      return <></>;
    }
  }
  return passThroughModule(importOriginal, { default: ReportingCropper });
}
